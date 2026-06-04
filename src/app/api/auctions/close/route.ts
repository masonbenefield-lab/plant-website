import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendAuctionWon,
  sendAuctionAutoCharged,
  sendAuctionPaymentFailed,
  sendAuctionEndingSoon,
  sendAuctionEndedSeller,
  sendAuctionPaymentReminder,
  sendAuctionPaymentExpired,
  sendReserveOfferExpired,
} from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { planFeePercent, type Plan } from "@/lib/plan-limits";
import { createStripeTaxCalculation } from "@/lib/tax";

const PAYMENT_DEADLINE_HOURS = 24; // fallback manual window (was 48)
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
    .select("id, plant_name, variety, ends_at")
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
    const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;

    await Promise.allSettled(
      bidderIds.map(async (bidderId) => {
        const { data: auth } = await supabase.auth.admin.getUserById(bidderId);
        const email = auth?.user?.email;
        if (email) await sendAuctionEndingSoon({ email, plantName: displayName, auctionUrl, endsAt: auction.ends_at });
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
    .select("id, current_bidder_id, seller_id, current_bid_cents, plant_name, variety, images, inventory_id, reserve_price_cents, free_shipping, shipping_cost_cents")
    .eq("status", "active")
    .lt("ends_at", now.toISOString());

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let closed = 0;
  let closeErrors = 0;
  for (const auction of expiredAuctions ?? []) {
    try {
    await supabase.from("auctions").update({ status: "ended" }).eq("id", auction.id);

    const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
    const reserveMet = !auction.reserve_price_cents || auction.current_bid_cents >= auction.reserve_price_cents;
    const hasWinner = !!(auction.current_bidder_id && reserveMet);

    // Fetch seller info for notifications
    const { data: sellerAuth } = await supabase.auth.admin.getUserById(auction.seller_id);
    const sellerEmail = sellerAuth?.user?.email;

    if (hasWinner) {
      const { data: winnerAuth } = await supabase.auth.admin.getUserById(auction.current_bidder_id!);
      const winnerEmail = winnerAuth?.user?.email;

      // Fetch buyer payment profile
      const { data: buyer } = await supabase
        .from("profiles")
        .select("stripe_customer_id, default_payment_method_id, saved_shipping_address")
        .eq("id", auction.current_bidder_id!)
        .single();

      // Fetch seller profile for fee calc and shipping
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("stripe_account_id, plan, is_admin, groundbreaker, ship_from_address")
        .eq("id", auction.seller_id)
        .single();

      const canAutoCharge = !!(
        buyer?.stripe_customer_id &&
        buyer?.default_payment_method_id &&
        sellerProfile?.stripe_account_id &&
        (auction.free_shipping || buyer?.saved_shipping_address)
      );

      if (canAutoCharge) {
        // Calculate shipping cost
        const shippingCents = auction.free_shipping ? 0 : (auction.shipping_cost_cents ?? 0);

        const shippingAddr = (buyer!.saved_shipping_address ?? {}) as Record<string, string>;
        const stripeShippingAddr = {
          line1: shippingAddr.line1 ?? shippingAddr.street1 ?? "",
          line2: shippingAddr.line2 ?? undefined,
          city: shippingAddr.city ?? "",
          state: shippingAddr.state ?? "",
          zip: shippingAddr.zip ?? "",
          country: shippingAddr.country ?? "US",
        };

        const { taxCents, calculationId } = await createStripeTaxCalculation(
          auction.current_bid_cents,
          shippingCents,
          stripeShippingAddr,
          auction.id
        ).catch(() => ({ taxCents: 0, calculationId: null }));

        const totalCents = auction.current_bid_cents + shippingCents + taxCents;
        const feePercent = planFeePercent(sellerProfile!.plan as Plan | null, !!sellerProfile!.is_admin, !!sellerProfile!.groundbreaker);
        const feeCents = Math.round(auction.current_bid_cents * (feePercent / 100));
        const stripeFeeCents = Math.round(totalCents * 0.029) + 30;
        const appFeeAmount = feeCents + stripeFeeCents + taxCents;

        const deadline = new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000);

        // Create order before charging — if order insert fails, fall back without
        // touching the buyer's card (internal error, not a payment failure)
        const { data: order, error: orderErr } = await supabase.from("orders").insert({
          buyer_id: auction.current_bidder_id!,
          seller_id: auction.seller_id,
          auction_id: auction.id,
          shipping_address: buyer!.saved_shipping_address as { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string; country: string } | null,
          amount_cents: totalCents,
          shipping_cost_cents: shippingCents,
          tax_cents: taxCents,
          platform_fee_cents: feeCents,
          payment_deadline_at: deadline.toISOString(),
          status: "pending",
          item_snapshot: {
            plant_name: auction.plant_name,
            variety: auction.variety ?? null,
            image: (auction.images as string[] | null)?.[0] ?? null,
          },
        }).select("id").single();

        if (orderErr || !order?.id) {
          await fallbackToManualCheckout(supabase, auction, now, appUrl, winnerEmail, sellerEmail, PAYMENT_DEADLINE_HOURS);
        } else {
          try {
            const pi = await getStripe().paymentIntents.create({
              amount: totalCents,
              currency: "usd",
              customer: buyer!.stripe_customer_id!,
              payment_method: buyer!.default_payment_method_id!,
              confirm: true,
              off_session: true,
              on_behalf_of: sellerProfile!.stripe_account_id!,
              transfer_data: { destination: sellerProfile!.stripe_account_id! },
              application_fee_amount: appFeeAmount,
              metadata: {
                order_id: order.id,
                auction_id: auction.id,
                auto_charged: "true",
                platform_fee_cents: String(feeCents),
                stripe_fee_cents: String(stripeFeeCents),
                tax_cents: String(taxCents),
                ...(calculationId ? { tax_calculation_id: calculationId } : {}),
              },
            });

            await supabase.from("orders").update({ stripe_payment_intent_id: pi.id }).eq("id", order.id);

            if (winnerEmail) {
              await sendAuctionAutoCharged({
                winnerEmail,
                plantName: displayName,
                amountCents: totalCents,
                orderId: order.id,
                appUrl,
              }).catch(() => {});
            }

            if (sellerEmail) {
              const { data: winnerProfile } = await supabase
                .from("profiles").select("username").eq("id", auction.current_bidder_id!).single();
              await sendAuctionEndedSeller({
                sellerEmail,
                plantName: displayName,
                winnerFound: true,
                winnerUsername: winnerProfile?.username ?? "The buyer",
                amountCents: auction.current_bid_cents,
                ordersUrl: `${appUrl}/orders?tab=sales`,
                autoCharged: true,
              }).catch(() => {});
            }

          } catch {
            // Stripe charge declined — clear the card and send manual checkout link
            await supabase.from("profiles").update({ default_payment_method_id: null }).eq("id", auction.current_bidder_id!);
            await fallbackToManualCheckout(supabase, auction, now, appUrl, winnerEmail, sellerEmail, PAYMENT_DEADLINE_HOURS);
          }
        }
      } else {
        // Buyer has no saved payment method or address — fall back to manual checkout
        await fallbackToManualCheckout(supabase, auction, now, appUrl, winnerEmail, sellerEmail, PAYMENT_DEADLINE_HOURS);
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
        const hadBids = !!auction.current_bidder_id;
        const reserveNotMet = !!(auction.reserve_price_cents && auction.current_bid_cents < auction.reserve_price_cents);
        await sendAuctionEndedSeller({
          sellerEmail,
          plantName: displayName,
          winnerFound: false,
          reserveNotMet: hadBids && reserveNotMet,
          amountCents: hadBids ? auction.current_bid_cents : undefined,
          ordersUrl: `${appUrl}/orders?tab=sales`,
        }).catch(() => {});
      }
    }

    closed++;
    } catch {
      closeErrors++;
    }
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
      .select("plant_name, variety")
      .eq("id", order.auction_id!)
      .single();
    const { data: buyerAuth } = await supabase.auth.admin.getUserById(order.buyer_id);
    const buyerEmail = buyerAuth?.user?.email;
    if (buyerEmail && auction) {
      const reminderDisplayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
      await sendAuctionPaymentReminder({
        winnerEmail: buyerEmail,
        plantName: reminderDisplayName,
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
      .select("plant_name, variety, current_bid_cents")
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
      const expiredDisplayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
      await sendAuctionPaymentExpired({
        sellerEmail,
        plantName: expiredDisplayName,
        winnerUsername: winnerProfile?.username ?? "The buyer",
        winningBidCents: order.amount_cents,
        hasSecondBidder: !!secondBid,
        offerUrl: `${appUrl}/orders?tab=sales&expired=${order.id}`,
        auctionId: order.auction_id!,
      }).catch(() => {});
    }
  }

  // ── 6. Expire pending reserve offers past their window ───────────────────────
  const { data: expiredOffers } = await supabase
    .from("auctions")
    .select("id, seller_id, plant_name, variety, current_bid_cents")
    .eq("reserve_offer_status", "pending")
    .lt("reserve_offer_expires_at", now.toISOString());

  for (const auction of expiredOffers ?? []) {
    await supabase.from("auctions").update({ reserve_offer_status: "expired" }).eq("id", auction.id);

    const { data: sellerAuth } = await supabase.auth.admin.getUserById(auction.seller_id);
    const sellerEmail = sellerAuth?.user?.email;
    const offerDisplayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
    if (sellerEmail) {
      await sendReserveOfferExpired({
        sellerEmail,
        plantName: offerDisplayName,
        bidCents: auction.current_bid_cents,
        dashboardUrl: `${appUrl}/dashboard/auctions`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({
    closed,
    closeErrors,
    reminders: reminderOrders?.length ?? 0,
    expired: expiredOrders?.length ?? 0,
    offersExpired: expiredOffers?.length ?? 0,
  });
}

async function fallbackToManualCheckout(
  supabase: ReturnType<typeof adminClient>,
  auction: { id: string; current_bidder_id: string | null; seller_id: string; current_bid_cents: number; plant_name: string; variety?: string | null; images?: string[] | null },
  now: Date,
  appUrl: string,
  winnerEmail: string | undefined,
  sellerEmail: string | undefined,
  deadlineHours: number
) {
  const deadline = new Date(now.getTime() + deadlineHours * 60 * 60 * 1000);
  const checkoutUrl = `${appUrl}/checkout?auction=${auction.id}`;
  const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;

  // Create/update a pending order so the cron can track non-payment
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("id")
    .eq("auction_id", auction.id)
    .eq("status", "pending")
    .single();

  if (existingOrder) {
    await supabase.from("orders").update({ payment_deadline_at: deadline.toISOString() }).eq("id", existingOrder.id);
  } else {
    await supabase.from("orders").insert({
      buyer_id: auction.current_bidder_id!,
      seller_id: auction.seller_id,
      auction_id: auction.id,
      amount_cents: auction.current_bid_cents,
      payment_deadline_at: deadline.toISOString(),
      status: "pending",
      item_snapshot: {
        plant_name: auction.plant_name,
        variety: auction.variety ?? null,
        image: auction.images?.[0] ?? null,
      },
    });
  }

  if (winnerEmail) {
    await sendAuctionPaymentFailed({
      winnerEmail,
      plantName: displayName,
      amountCents: auction.current_bid_cents,
      checkoutUrl,
    }).catch(() => {});
  }

  if (sellerEmail) {
    await sendAuctionEndedSeller({
      sellerEmail,
      plantName: displayName,
      winnerFound: true,
      winnerUsername: "The buyer",
      amountCents: auction.current_bid_cents,
      ordersUrl: `${appUrl}/orders?tab=sales`,
    }).catch(() => {});
  }
}
