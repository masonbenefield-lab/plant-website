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

function getMinIncrement(currentBidCents: number): number {
  if (currentBidCents < 1000)  return 100;   // under $10   → +$1
  if (currentBidCents < 5000)  return 200;   // $10–$49     → +$2
  if (currentBidCents < 20000) return 500;   // $50–$199    → +$5
  return 1000;                                // $200+       → +$10
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to bid" }, { status: 401 });

  const { auctionId, amountCents, maxBidCents } = await request.json() as {
    auctionId: string;
    amountCents: number;
    maxBidCents?: number | null;
  };

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

  const minIncrement = getMinIncrement(auction.current_bid_cents);
  const minBid = auction.current_bid_cents + minIncrement;
  if (amountCents < minBid) {
    return NextResponse.json({ error: `Minimum bid is $${(minBid / 100).toFixed(2)} (minimum increment: $${(minIncrement / 100).toFixed(0)})` }, { status: 400 });
  }

  if (maxBidCents !== null && maxBidCents !== undefined && maxBidCents < amountCents) {
    return NextResponse.json({ error: "Max bid must be at least your current bid amount" }, { status: 400 });
  }

  // Insert the incoming bid
  const { error: bidError } = await admin.from("bids").insert({
    auction_id: auctionId,
    bidder_id: user.id,
    amount_cents: amountCents,
    max_bid_cents: maxBidCents ?? null,
  });
  if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });

  // Check if the current leader has a proxy max that can auto-respond
  if (auction.current_bidder_id && auction.current_bidder_id !== user.id) {
    const { data: proxyRows } = await admin
      .from("bids")
      .select("max_bid_cents")
      .eq("auction_id", auctionId)
      .eq("bidder_id", auction.current_bidder_id)
      .not("max_bid_cents", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    const proxyMax = proxyRows?.[0]?.max_bid_cents ?? null;

    if (proxyMax !== null) {
      const counterCents = amountCents + getMinIncrement(amountCents);
      if (counterCents <= proxyMax) {
        // Proxy fires: insert auto-counter bid for the previous leader
        const { error: proxyBidError } = await admin.from("bids").insert({
          auction_id: auctionId,
          bidder_id: auction.current_bidder_id,
          amount_cents: counterCents,
        });
        if (proxyBidError) return NextResponse.json({ error: proxyBidError.message }, { status: 500 });

        // Update auction with proxy counter (with snipe protection)
        const now = new Date();
        const endsAt = new Date(auction.ends_at);
        const SNIPE_WINDOW_MS = 2 * 60 * 1000;
        const extended = endsAt.getTime() - now.getTime() < SNIPE_WINDOW_MS;
        const newEndsAt = extended ? new Date(now.getTime() + SNIPE_WINDOW_MS).toISOString() : undefined;

        await admin.from("auctions").update({
          current_bid_cents: counterCents,
          current_bidder_id: auction.current_bidder_id,
          ...(extended ? { ends_at: newEndsAt } : {}),
        }).eq("id", auctionId);

        return NextResponse.json({
          ok: true,
          outbidByProxy: true,
          proxyBid: counterCents,
          previousBidderId: null, // current leader still leads — don't notify them
        });
      }
    }
  }

  // Normal win: incoming bidder takes the lead
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
