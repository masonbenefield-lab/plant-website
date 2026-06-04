import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId, listingIds, auctionId } = await request.json() as {
    listingId?: string;
    listingIds?: string[];
    auctionId?: string;
  };

  if (!listingId && !listingIds?.length && !auctionId) {
    return NextResponse.json({ error: "listing or auction required" }, { status: 400 });
  }

  if (listingIds?.length) {
    const { data: listings } = await supabase
      .from("listings")
      .select("id, seller_id, inventory_id, free_shipping, shipping_cost_cents")
      .in("id", listingIds);

    if (!listings?.length) return NextResponse.json({ error: "Listings not found" }, { status: 404 });

    const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
    if (sellerIds.length > 1) return NextResponse.json({ error: "Cart items must be from one seller" }, { status: 400 });

    const invIds = listings.map((l) => l.inventory_id).filter(Boolean) as string[];
    type InvRow = { id: string; free_shipping: boolean | null; shipping_cost_cents: number | null };
    let invMap: Record<string, InvRow> = {};
    if (invIds.length) {
      const { data: invs } = await supabase
        .from("inventory")
        .select("id, free_shipping, shipping_cost_cents")
        .in("id", invIds);
      invMap = Object.fromEntries((invs ?? []).map((inv) => [inv.id, inv as InvRow]));
    }

    let totalFlatCents = 0;
    type ItemBreakdown = { listingId: string; mode: "free" | "flat"; flatCents?: number };
    const itemBreakdown: ItemBreakdown[] = [];

    for (const listing of listings) {
      const inv = listing.inventory_id ? invMap[listing.inventory_id] : null;
      const isFree = inv?.free_shipping ?? listing.free_shipping ?? false;
      const flatCents = inv?.shipping_cost_cents ?? listing.shipping_cost_cents ?? null;

      if (isFree) {
        itemBreakdown.push({ listingId: listing.id, mode: "free" });
      } else if (flatCents) {
        totalFlatCents += flatCents;
        itemBreakdown.push({ listingId: listing.id, mode: "flat", flatCents });
      }
    }

    if (totalFlatCents === 0) return NextResponse.json({ rates: [], freeShipping: true, itemBreakdown });
    return NextResponse.json({ rates: [], flatRate: true, flatRateCents: totalFlatCents, itemBreakdown });
  }

  if (listingId) {
    const { data: listing } = await supabase
      .from("listings")
      .select("inventory_id, free_shipping, shipping_cost_cents")
      .eq("id", listingId)
      .single();
    if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

    if (listing.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("free_shipping, shipping_cost_cents")
        .eq("id", listing.inventory_id)
        .single();
      const flatCents = inv?.shipping_cost_cents ?? listing.shipping_cost_cents;
      if (inv?.free_shipping || listing.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (flatCents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: flatCents });
    } else {
      if (listing.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
      if (listing.shipping_cost_cents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: listing.shipping_cost_cents });
    }

    return NextResponse.json({ error: "No shipping rate configured for this listing" }, { status: 400 });
  }

  // auctionId
  const { data: auction } = await supabase
    .from("auctions")
    .select("inventory_id, free_shipping, shipping_cost_cents")
    .eq("id", auctionId!)
    .single();
  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });

  if (auction.inventory_id) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("free_shipping, shipping_cost_cents")
      .eq("id", auction.inventory_id)
      .single();
    const flatCents = inv?.shipping_cost_cents ?? auction.shipping_cost_cents;
    if (inv?.free_shipping || auction.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
    if (flatCents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: flatCents });
  } else {
    if (auction.free_shipping) return NextResponse.json({ rates: [], freeShipping: true });
    if (auction.shipping_cost_cents) return NextResponse.json({ rates: [], flatRate: true, flatRateCents: auction.shipping_cost_cents });
  }

  return NextResponse.json({ error: "No shipping rate configured for this auction" }, { status: 400 });
}
