import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isBlocked } from "@/lib/blocks";
import { sendOutbidNotification } from "@/lib/email";
import { getStripe } from "@/lib/stripe";

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

async function notifyOutbid(
  admin: ReturnType<typeof adminClient>,
  bidderId: string,
  plantName: string,
  auctionId: string,
  newBidCents: number
) {
  try {
    const { data: auth } = await admin.auth.admin.getUserById(bidderId);
    const email = auth?.user?.email;
    if (email) {
      await sendOutbidNotification({ bidderEmail: email, plantName, auctionId, newBidCents });
    }
  } catch {
    // Email failure is non-fatal
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to bid" }, { status: 401 });

  const {
    auctionId, amountCents, maxBidCents,
    shippingRateId, shippingService, shippingCarrier, shippingCostCents, estimatedDays,
  } = await request.json() as {
    auctionId: string;
    amountCents: number;
    maxBidCents?: number | null;
    shippingRateId?: string | null;
    shippingService?: string | null;
    shippingCarrier?: string | null;
    shippingCostCents?: number | null;
    estimatedDays?: number | null;
  };

  const admin = adminClient();

  const { data: bidderProfile } = await admin
    .from("profiles")
    .select("default_payment_method_id, saved_shipping_address")
    .eq("id", user.id)
    .single();

  if (!bidderProfile?.default_payment_method_id) {
    return NextResponse.json({ error: "payment_method_required" }, { status: 403 });
  }

  // Check card is not expired
  try {
    const pm = await getStripe().paymentMethods.retrieve(bidderProfile.default_payment_method_id);
    if (pm.type === "card" && pm.card) {
      const now = new Date();
      const expYear = pm.card.exp_year;
      const expMonth = pm.card.exp_month;
      const isExpired = expYear < now.getFullYear() ||
        (expYear === now.getFullYear() && expMonth < now.getMonth() + 1);
      if (isExpired) {
        return NextResponse.json({
          error: "card_expired",
          message: "Your saved card has expired. Please update your payment method in Account Settings.",
        }, { status: 402 });
      }
    }
  } catch {
    // If Stripe check fails, allow bid to proceed — don't block on a network hiccup
  }

  const { data: auction, error: auctionErr } = await admin
    .from("auctions")
    .select("id, seller_id, plant_name, variety, current_bid_cents, current_bidder_id, status, ends_at, shipping_weight_oz")
    .eq("id", auctionId)
    .single();

  if (!bidderProfile.saved_shipping_address) {
    return NextResponse.json({ error: "shipping_address_required" }, { status: 403 });
  }

  if (auction?.shipping_weight_oz) {
    if (!shippingRateId || shippingCostCents == null) {
      return NextResponse.json({ error: "shipping_rate_required" }, { status: 400 });
    }
  }

  if (auctionErr || !auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "active") return NextResponse.json({ error: "Auction is not active" }, { status: 400 });
  if (new Date(auction.ends_at) <= new Date()) return NextResponse.json({ error: "Auction has ended" }, { status: 400 });
  if (auction.seller_id === user.id) return NextResponse.json({ error: "You can't bid on your own auction" }, { status: 400 });
  if (await isBlocked(user.id, auction.seller_id)) return NextResponse.json({ error: "Unable to place bid." }, { status: 403 });

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "Invalid bid amount" }, { status: 400 });
  }

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

  // Save shipping selection for weight-based auctions
  if (auction.shipping_weight_oz && shippingRateId && shippingCostCents != null) {
    await admin.from("auction_shipping_selections").upsert({
      auction_id: auctionId,
      bidder_id: user.id,
      rate_id: shippingRateId,
      service: shippingService ?? null,
      carrier: shippingCarrier ?? null,
      cost_cents: shippingCostCents,
      estimated_days: estimatedDays ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "auction_id,bidder_id" });
  }

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

        // Resolve proxy war: if the incoming bidder also has a max bid, determine
        // the final winner now rather than stopping after one proxy counter.
        let finalLeaderId = auction.current_bidder_id!;
        let finalBidCents = counterCents;

        if (maxBidCents && maxBidCents > counterCents) {
          if (maxBidCents > proxyMax) {
            // Incoming bidder's max beats the leader's max — incoming bidder wins
            // at one increment above the leader's max
            finalBidCents = Math.min(proxyMax + getMinIncrement(proxyMax), maxBidCents);
            finalLeaderId = user.id;
          } else {
            // Leader's max still beats incoming — settle at one increment above incoming max
            finalBidCents = Math.min(maxBidCents + getMinIncrement(maxBidCents), proxyMax);
          }
          // Record the final proxy bid
          await admin.from("bids").insert({
            auction_id: auctionId,
            bidder_id: finalLeaderId,
            amount_cents: finalBidCents,
          });
        }

        const { error: proxyUpdateError } = await admin.from("auctions").update({
          current_bid_cents: finalBidCents,
          current_bidder_id: finalLeaderId,
          ...(extended ? { ends_at: newEndsAt } : {}),
        }).eq("id", auctionId);

        if (proxyUpdateError) return NextResponse.json({ error: proxyUpdateError.message }, { status: 500 });

        const proxyDisplayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;

        if (finalLeaderId === user.id) {
          // Incoming bidder won the proxy war — notify the displaced leader
          notifyOutbid(admin, auction.current_bidder_id!, proxyDisplayName, auctionId, finalBidCents);
          return NextResponse.json({ ok: true, extended, wonProxyWar: true, finalBid: finalBidCents });
        }

        // Leader's proxy held — notify incoming bidder they were outbid
        notifyOutbid(admin, user.id, proxyDisplayName, auctionId, finalBidCents);
        return NextResponse.json({ ok: true, outbidByProxy: true, proxyBid: finalBidCents });
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

  // Notify the displaced leader server-side
  if (auction.current_bidder_id && auction.current_bidder_id !== user.id) {
    const outbidDisplayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
    notifyOutbid(admin, auction.current_bidder_id, outbidDisplayName, auctionId, amountCents);
  }

  return NextResponse.json({ ok: true, extended });
}
