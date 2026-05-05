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
  if (!user) return NextResponse.json({ error: "Sign in to bid" }, { status: 401 });

  const { auctionId, amountCents } = await request.json() as { auctionId: string; amountCents: number };

  const admin = adminClient();

  const { data: bidderProfile } = await admin
    .from("profiles")
    .select("stripe_onboarded")
    .eq("id", user.id)
    .single();

  if (!bidderProfile?.stripe_onboarded) {
    return NextResponse.json({ error: "Connect a payment account before bidding" }, { status: 403 });
  }

  const { data: auction, error: auctionErr } = await admin
    .from("auctions")
    .select("id, seller_id, current_bid_cents, current_bidder_id, status, ends_at")
    .eq("id", auctionId)
    .single();

  if (auctionErr || !auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "active") return NextResponse.json({ error: "Auction is not active" }, { status: 400 });
  if (new Date(auction.ends_at) <= new Date()) return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
  if (auction.seller_id === user.id) return NextResponse.json({ error: "You can't bid on your own auction" }, { status: 400 });

  const minBid = auction.current_bid_cents + 1;
  if (amountCents < minBid) {
    return NextResponse.json({ error: `Bid must be at least $${(minBid / 100).toFixed(2)}` }, { status: 400 });
  }

  const { error: bidError } = await admin.from("bids").insert({
    auction_id: auctionId,
    bidder_id: user.id,
    amount_cents: amountCents,
  });
  if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });

  const now = new Date();
  const endsAt = new Date(auction.ends_at);
  const SNIPE_WINDOW_MS = 2 * 60 * 1000;
  const extended = endsAt.getTime() - now.getTime() < SNIPE_WINDOW_MS;
  const newEndsAt = extended ? new Date(now.getTime() + SNIPE_WINDOW_MS).toISOString() : undefined;

  const { error: updateError } = await admin
    .from("auctions")
    .update({
      current_bid_cents: amountCents,
      current_bidder_id: user.id,
      ...(extended ? { ends_at: newEndsAt } : {}),
    })
    .eq("id", auctionId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    extended,
    previousBidderId: auction.current_bidder_id,
  });
}
