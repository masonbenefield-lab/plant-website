import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { getShippingRates } from "@/lib/shippo";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const { zip, listingId, auctionId } = await request.json() as {
    zip: string;
    listingId?: string;
    auctionId?: string;
  };

  if (!zip || !/^\d{5}$/.test(zip.trim())) {
    return NextResponse.json({ error: "Enter a valid 5-digit ZIP code" }, { status: 400 });
  }
  if (!listingId && !auctionId) {
    return NextResponse.json({ error: "listing or auction required" }, { status: 400 });
  }

  const admin = adminClient();
  let sellerId: string;
  let weightOz: number;
  let freeShipping = false;
  let flatRateCents: number | null = null;

  if (listingId) {
    const { data: listing } = await admin
      .from("listings")
      .select("seller_id, inventory_id, free_shipping, shipping_weight_oz, shipping_cost_cents")
      .eq("id", listingId)
      .single();
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    sellerId = listing.seller_id;

    if (listing.inventory_id) {
      const { data: inv } = await admin
        .from("inventory")
        .select("shipping_weight_oz, free_shipping, shipping_cost_cents")
        .eq("id", listing.inventory_id)
        .single();
      freeShipping = inv?.free_shipping ?? listing.free_shipping;
      flatRateCents = inv?.shipping_cost_cents ?? listing.shipping_cost_cents ?? null;
      weightOz = inv?.shipping_weight_oz ?? listing.shipping_weight_oz ?? 16;
    } else {
      freeShipping = listing.free_shipping;
      flatRateCents = listing.shipping_cost_cents ?? null;
      weightOz = listing.shipping_weight_oz ?? 16;
    }
  } else {
    const { data: auction } = await admin
      .from("auctions")
      .select("seller_id, inventory_id, free_shipping, shipping_weight_oz, shipping_cost_cents")
      .eq("id", auctionId!)
      .single();
    if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
    sellerId = auction.seller_id;

    if (auction.inventory_id) {
      const { data: inv } = await admin
        .from("inventory")
        .select("shipping_weight_oz, free_shipping, shipping_cost_cents")
        .eq("id", auction.inventory_id)
        .single();
      freeShipping = inv?.free_shipping ?? auction.free_shipping;
      flatRateCents = inv?.shipping_cost_cents ?? auction.shipping_cost_cents ?? null;
      weightOz = inv?.shipping_weight_oz ?? auction.shipping_weight_oz ?? 16;
    } else {
      freeShipping = auction.free_shipping;
      flatRateCents = auction.shipping_cost_cents ?? null;
      weightOz = auction.shipping_weight_oz ?? 16;
    }
  }

  if (freeShipping) {
    return NextResponse.json({ freeShipping: true });
  }

  if (flatRateCents) {
    return NextResponse.json({ flatRate: true, flatRateCents });
  }

  const { data: seller } = await admin
    .from("profiles")
    .select("ship_from_address, shipping_services")
    .eq("id", sellerId)
    .single();

  if (!seller?.ship_from_address) {
    return NextResponse.json({ error: "Seller shipping not configured" }, { status: 400 });
  }

  const from = seller.ship_from_address as {
    name: string; street1: string; city: string; state: string; zip: string; country: string;
  };

  try {
    const rates = await getShippingRates({
      from,
      to: {
        name: "Buyer",
        street1: "123 Main St",
        city: "Anytown",
        state: "TX",
        zip: zip.trim(),
        country: "US",
      },
      weightOz,
      enabledServices: (seller.shipping_services as string[] | null) ?? undefined,
    });

    return NextResponse.json({ rates });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unable to estimate shipping";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
