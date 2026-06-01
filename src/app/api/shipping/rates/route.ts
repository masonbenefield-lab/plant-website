import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShippingRates } from "@/lib/shippo";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId, listingIds, auctionId, toAddress } = await request.json() as {
    listingId?: string;
    listingIds?: string[];   // cart: multiple listings from one seller
    auctionId?: string;
    toAddress: { name: string; street1: string; street2?: string | null; city: string; state: string; zip: string; country: string };
  };

  if (!listingId && !listingIds?.length && !auctionId) {
    return NextResponse.json({ error: "listing or auction required" }, { status: 400 });
  }

  let sellerId: string;
  let weightOz: number;

  if (listingIds?.length) {
    // Cart: multiple listings from one seller — resolve shipping per listing
    const { data: listings } = await supabase
      .from("listings")
      .select("seller_id, inventory_id, free_shipping, shipping_cost_cents")
      .in("id", listingIds);

    if (!listings?.length) return NextResponse.json({ error: "Listings not found" }, { status: 404 });

    const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
    if (sellerIds.length > 1) return NextResponse.json({ error: "Cart items must be from one seller" }, { status: 400 });
    sellerId = sellerIds[0];

    const invIds = listings.map((l) => l.inventory_id).filter(Boolean) as string[];
    type InvRow = { id: string; shipping_weight_oz: number | null; free_shipping: boolean | null; shipping_cost_cents: number | null };
    let invMap: Record<string, InvRow> = {};
    if (invIds.length) {
      const { data: invs } = await supabase
        .from("inventory")
        .select("id, shipping_weight_oz, free_shipping, shipping_cost_cents")
        .in("id", invIds);
      invMap = Object.fromEntries((invs ?? []).map((inv) => [inv.id, inv as InvRow]));
    }

    // Resolve per-listing shipping — one pass, all combinations handled
    let totalFlatCents = 0;
    let needsCalculated = false;
    weightOz = 0;

    for (const listing of listings) {
      const inv = listing.inventory_id ? invMap[listing.inventory_id] : null;
      const isFree = inv?.free_shipping ?? (listing as { free_shipping?: boolean | null }).free_shipping ?? false;
      const flatCents = inv?.shipping_cost_cents ?? (listing as { shipping_cost_cents?: number | null }).shipping_cost_cents ?? null;
      const itemWeight = inv?.shipping_weight_oz ?? 16;

      weightOz += itemWeight; // always accumulate weight in case Shippo is needed
      if (isFree) {
        // contributes $0
      } else if (flatCents) {
        totalFlatCents += flatCents;
      } else {
        needsCalculated = true;
      }
    }

    // free+free → freeShipping, free+flat → flatRate, flat+flat → flatRate, any+Shippo → Shippo
    if (!needsCalculated) {
      if (totalFlatCents === 0) return NextResponse.json({ rates: [], freeShipping: true });
      return NextResponse.json({ rates: [], flatRate: true, flatRateCents: totalFlatCents });
    }
    // Mixed flat+Shippo: use Shippo for full weight, flat-rate costs absorbed into the calculated rate
  } else if (listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("seller_id, inventory_id, free_shipping, shipping_cost_cents, shipping_weight_oz")
      .eq("id", listingId)
      .single();
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    sellerId = listing.seller_id;

    if (listing.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("shipping_weight_oz, free_shipping, shipping_cost_cents")
        .eq("id", listing.inventory_id)
        .single();
      const flatCents = inv?.shipping_cost_cents ?? listing.shipping_cost_cents;
      if (inv?.free_shipping || listing.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (flatCents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: flatCents });
      weightOz = inv?.shipping_weight_oz ?? listing.shipping_weight_oz ?? 16;
    } else {
      if (listing.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (listing.shipping_cost_cents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: listing.shipping_cost_cents });
      weightOz = listing.shipping_weight_oz ?? 16;
    }
  } else {
    const { data: auction } = await supabase
      .from("auctions")
      .select("seller_id, inventory_id, free_shipping, shipping_cost_cents, shipping_weight_oz")
      .eq("id", auctionId!)
      .single();
    if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    sellerId = auction.seller_id;

    if (auction.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("shipping_weight_oz, free_shipping, shipping_cost_cents")
        .eq("id", auction.inventory_id)
        .single();
      const flatCents = inv?.shipping_cost_cents ?? auction.shipping_cost_cents;
      if (inv?.free_shipping || auction.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (flatCents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: flatCents });
      weightOz = inv?.shipping_weight_oz ?? auction.shipping_weight_oz ?? 16;
    } else {
      if (auction.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (auction.shipping_cost_cents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: auction.shipping_cost_cents });
      weightOz = auction.shipping_weight_oz ?? 16;
    }
  }

  const { data: seller } = await supabase
    .from("profiles")
    .select("ship_from_address, shipping_services")
    .eq("id", sellerId)
    .single();

  if (!seller?.ship_from_address) {
    return NextResponse.json({ error: "Seller has not configured a ship-from address" }, { status: 400 });
  }

  const from = seller.ship_from_address as {
    name: string; street1: string; city: string; state: string; zip: string; country: string; phone?: string;
  };

  // Domestic-only enforcement
  if (from.country !== toAddress.country) {
    return NextResponse.json({ error: `This seller only ships within ${from.country}` }, { status: 400 });
  }

  try {
    const rates = await getShippingRates({
      from,
      to: toAddress,
      weightOz,
      enabledServices: (seller.shipping_services as string[] | null) ?? undefined,
    });

    if (!rates.length) {
      return NextResponse.json({ error: "No shipping rates available for this destination" }, { status: 400 });
    }

    return NextResponse.json({ rates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch shipping rates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
