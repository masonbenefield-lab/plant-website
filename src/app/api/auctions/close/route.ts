import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendAuctionWon,
  sendAuctionEndingSoon,
  sendAuctionEndedSeller,
  sendAuctionPaymentReminder,
  sendAuctionPaymentExpired,
} from "@/lib/email";

const PAYMENT_DEADLINE_HOURS = 48;
const REMINDER_HOURS_BEFORE = 4;

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = adminClient();
  const now = new Date();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop";

  // ── 1. Send ending-soon reminders (within 60 min, not yet reminded) ──────────
  const in60min = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
  const { data: soonAuctions } = await supabase
    .from("auctions")
    .select("id, plant_name, ends_at")
    .eq("status", "active")
    .eq("reminder_sent", false)
    .gt("ends_at", now.toISOString())
    .lt("ends_at", in60min);

  for (const auction of soonAuctions ?? []) {
    const { data: bids } = await supabase
      .from("bids")
      .select("bidder_id")
      .eq("auction_id", auction.id);

    const bidderIds = [...new Set((bids ?? []).map((b) => b.bidder_id))];
    const auctionUrl = `${appUrl}/auctions/${auction.id}`;

    await Promise.allSettled(
      bidderIds.map(async (bidderId) => {
        const { data: auth } = await supabase.auth.admin.getUserById(bidderId);
        const email = auth?.user?.email;
        if (email) await sendAuctionEndingSoon({ email, plantName: auction.plant_name, auctionUrl, endsAt: auction.ends_at });
      })
    );

    await supabase.from("auctions").update({ reminder_sent: true }).eq("id", auction.id);
  }

  // ── 2. Activate scheduled auctions whose start time has passed ────────────────
  const { data: scheduledAuctions } = await supabase
    .from("auctions")
    .select("id")
    .eq("status", "scheduled")
    .lt("starts_at", now.toISOString());
  for (const auction of scheduledAuctions ?? []) {
    await supabase.from("auctions").update({ status: "active" }).eq("id", auction.id);
  }

  // ── 3. Close expired active auctions ─────────────────────────────────────────
  const { data: expiredAuctions, error } = await supabase
    .from("auctions")
    .select("id, current_bidder_id, seller_id, current_bid_cents, plant_name, inventory_id, reserve_price_cents")
    .eq("status", "active")
    .lt("ends_at", now.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let closed = 0;
  for (const auction of expiredAuctions ?? []) {
    await supabase.from("auctions").update({ status: "ended" }).eq("id", auction.id);

    const reserveMet = !auction.reserve_price_cents || auction.current_bid_cents >= auction.reserve_price_cents;
    const hasWinner = !!(auction.current_bidder_id && reserveMet);

    // Fetch seller info for notifications
    const { data: sellerAuth } = await supabase.auth.admin.getUserById(auction.seller_id);
    const sellerEmail = sellerAuth?.user?.email;

    if (hasWinner) {
      const deadline = new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000);
      const checkoutUrl = `${appUrl}/checkout?auction=${auction.id}`;

      // Email the winner with checkout link
      const { data: winnerAuth } = await supabase.auth.admin.getUserById(auction.current_bidder_id!);
      const winnerEmail = winnerAuth?.user?.email;
      if (winnerEmail) {
        await sendAuctionWon({
          winnerEmail,
          plantName: auction.plant_name,
          amountCents: auction.current_bid_cents,
          checkoutUrl,
        }).catch(() => {});
      }

      // Store the payment deadline on any pending order (if winner already started checkout)
      // Also used by subsequent cron runs to detect non-payment
      await supabase
        .from("orders")
        .update({ payment_deadline_at: deadline.toISOString() })
        .eq("auction_id", auction.id)
        .eq("status", "pending");

      // Email the seller that their auction ended with a winner
      if (sellerEmail) {
        const { data: winnerProfile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", auction.current_bidder_id!)
          .single();
        await sendAuctionEndedSeller({
          sellerEmail,
          plantName: auction.plant_name,
          winnerFound: true,
          winnerUsername: winnerProfile?.username ?? "The buyer",
          amountCents: auction.current_bid_cents,
          ordersUrl: `${appUrl}/orders?tab=sales`,
        }).catch(() => {});
      }
    } else {
      // No winner — release inventory if linked
      if (auction.inventory_id) {
        await supabase.from("inventory").update({
          auction_id: null,
          auction_quantity: null,
        }).eq("id", auction.inventory_id);
      }

      // Email seller that their auction ended with no winner
      if (sellerEmail) {
        await sendAuctionEndedSeller({
          sellerEmail,
          plantName: auction.plant_name,
          winnerFound: false,
          amountCents: auction.reserve_price_cents ? auction.current_bid_cents : undefined,
          ordersUrl: `${appUrl}/orders?tab=sales`,
        }).catch(() => {});
      }
    }

    closed++;
  }

  // ── 4. Send payment reminders for orders approaching deadline ────────────────
  const reminderCutoff = new Date(now.getTime() + REMINDER_HOURS_BEFORE * 60 * 60 * 1000).toISOString();
  const { data: reminderOrders } = await supabase
    .from("orders")
    .select("id, buyer_id, auction_id, payment_deadline_at")
    .eq("status", "pending")
    .eq("payment_reminder_sent", false)
    .not("auction_id", "is", null)
    .not("payment_deadline_at", "is", null)
    .gt("payment_deadline_at", now.toISOString())
    .lt("payment_deadline_at", reminderCutoff);

  for (const order of reminderOrders ?? []) {
    const { data: auction } = await supabase
      .from("auctions")
      .select("plant_name")
      .eq("id", order.auction_id!)
      .single();
    const { data: buyerAuth } = await supabase.auth.admin.getUserById(order.buyer_id);
    const buyerEmail = buyerAuth?.user?.email;
    if (buyerEmail && auction) {
      await sendAuctionPaymentReminder({
        winnerEmail: buyerEmail,
        plantName: auction.plant_name,
        checkoutUrl: `${appUrl}/checkout?auction=${order.auction_id}`,
        deadlineAt: order.payment_deadline_at!,
      }).catch(() => {});
    }
    await supabase.from("orders").update({ payment_reminder_sent: true }).eq("id", order.id);
  }

  // ── 5. Expire orders where payment deadline has passed ────────────────────────
  const { data: expiredOrders } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, auction_id, amount_cents")
    .eq("status", "pending")
    .not("auction_id", "is", null)
    .not("payment_deadline_at", "is", null)
    .lt("payment_deadline_at", now.toISOString());

  for (const order of expiredOrders ?? []) {
    // Mark the order expired
    await supabase.from("orders").update({ status: "expired" }).eq("id", order.id);

    const { data: auction } = await supabase
      .from("auctions")
      .select("plant_name, current_bid_cents")
      .eq("id", order.auction_id!)
      .single();

    const { data: winnerProfile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", order.buyer_id)
      .single();

    // Check if there's a second bidder to offer to
    const { data: secondBid } = await supabase
      .from("bids")
      .select("bidder_id, amount_cents")
      .eq("auction_id", order.auction_id!)
      .neq("bidder_id", order.buyer_id)
      .order("amount_cents", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: sellerAuth } = await supabase.auth.admin.getUserById(order.seller_id);
    const sellerEmail = sellerAuth?.user?.email;

    if (sellerEmail && auction) {
      await sendAuctionPaymentExpired({
        sellerEmail,
        plantName: auction.plant_name,
        winnerUsername: winnerProfile?.username ?? "The buyer",
        winningBidCents: order.amount_cents,
        hasSecondBidder: !!secondBid,
        offerUrl: `${appUrl}/orders?tab=sales&expired=${order.id}`,
        auctionId: order.auction_id!,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ closed, reminders: reminderOrders?.length ?? 0, expired: expiredOrders?.length ?? 0 });
}
