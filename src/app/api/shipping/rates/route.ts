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
    // Cart: multiple listings from one seller — sum weights
    const { data: listings } = await supabase
      .from("listings")
      .select("seller_id, inventory_id")
      .in("id", listingIds);

    if (!listings?.length) return NextResponse.json({ error: "Listings not found" }, { status: 404 });

    const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
    if (sellerIds.length > 1) return NextResponse.json({ error: "Cart items must be from one seller" }, { status: 400 });
    sellerId = sellerIds[0];

    const invIds = listings.map((l) => l.inventory_id).filter(Boolean) as string[];
    if (invIds.length) {
      const { data: invs } = await supabase
        .from("inventory")
        .select("shipping_weight_oz, free_shipping")
        .in("id", invIds);
      if (invs?.length && invs.every((inv) => inv.free_shipping)) {
        return NextResponse.json({ rates: [], freeShipping: true });
      }
      weightOz = (invs ?? []).reduce((sum, inv) => sum + (inv.shipping_weight_oz ?? 16), 0);
    } else {
      weightOz = listings.length * 16; // default 1lb per item
    }
  } else if (listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("seller_id, inventory_id")
      .eq("id", listingId)
      .single();
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    sellerId = listing.seller_id;

    if (listing.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("shipping_weight_oz, free_shipping")
        .eq("id", listing.inventory_id)
        .single();
      if (inv?.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      weightOz = inv?.shipping_weight_oz ?? 16;
    } else {
      weightOz = 16;
    }
  } else {
    const { data: auction } = await supabase
      .from("auctions")
      .select("seller_id, inventory_id")
      .eq("id", auctionId!)
      .single();
    if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    sellerId = auction.seller_id;

    if (auction.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("shipping_weight_oz, free_shipping")
        .eq("id", auction.inventory_id)
        .single();
      if (inv?.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      weightOz = inv?.shipping_weight_oz ?? 16;
    } else {
      weightOz = 16;
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
