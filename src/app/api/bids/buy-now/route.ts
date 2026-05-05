import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to buy" }, { status: 401 });

  const { auctionId } = await request.json() as { auctionId: string };

  const admin = adminClient();

  const { data: bidderProfile } = await admin
    .from("profiles")
    .select("stripe_onboarded")
    .eq("id", user.id)
    .single();

  if (!bidderProfile?.stripe_onboarded) {
    return NextResponse.json({ error: "Connect a payment account before buying" }, { status: 403 });
  }

  const { data: auction, error: auctionErr } = await admin
    .from("auctions")
    .select("id, seller_id, current_bid_cents, current_bidder_id, buy_now_price_cents, status, ends_at")
    .eq("id", auctionId)
    .single();

  if (auctionErr || !auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "active") return NextResponse.json({ error: "Auction is not active" }, { status: 400 });
  if (!auction.buy_now_price_cents) return NextResponse.json({ error: "No buy now price set" }, { status: 400 });
  if (auction.seller_id === user.id) return NextResponse.json({ error: "You can't buy your own auction" }, { status: 400 });

  const { error: bidError } = await admin.from("bids").insert({
    auction_id: auctionId,
    bidder_id: user.id,
    amount_cents: auction.buy_now_price_cents,
  });
  if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });

  const { error: updateError } = await admin
    .from("auctions")
    .update({
      current_bid_cents: auction.buy_now_price_cents,
      current_bidder_id: user.id,
      status: "ended",
    })
    .eq("id", auctionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    previousBidderId: auction.current_bidder_id,
    buyNowCents: auction.buy_now_price_cents,
  });
}
