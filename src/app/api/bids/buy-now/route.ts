import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOutbidNotification, sendAuctionAutoCharged, sendAuctionPaymentFailed, sendAuctionEndedSeller } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { planFeePercent } from "@/lib/plan-limits";
import { createStripeTaxCalculation } from "@/lib/tax";

const PAYMENT_DEADLINE_HOURS = 24;

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
    .select("default_payment_method_id")
    .eq("id", user.id)
    .single();

  if (!bidderProfile?.default_payment_method_id) {
    return NextResponse.json({ error: "Add a payment method before buying" }, { status: 403 });
  }

  const { data: auction, error: auctionErr } = await admin
    .from("auctions")
    .select("id, seller_id, plant_name, variety, current_bid_cents, current_bidder_id, buy_now_price_cents, status, ends_at, free_shipping, shipping_cost_cents, shipping_weight_oz, inventory_id")
    .eq("id", auctionId)
    .single();

  if (auctionErr || !auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "active") return NextResponse.json({ error: "Auction is not active" }, { status: 400 });
  if (!auction.buy_now_price_cents) return NextResponse.json({ error: "No buy now price set" }, { status: 400 });
  if (auction.seller_id === user.id) return NextResponse.json({ error: "You can't buy your own auction" }, { status: 400 });

  const previousBidderId = auction.current_bidder_id;
  const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;

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

  // Notify previous high bidder they were outbid (non-blocking)
  if (previousBidderId && previousBidderId !== user.id) {
    const { data: prevAuth } = await admin.auth.admin.getUserById(previousBidderId);
    const prevEmail = prevAuth?.user?.email;
    if (prevEmail) {
      sendOutbidNotification({
        bidderEmail: prevEmail,
        plantName: displayName,
        auctionId,
        newBidCents: auction.buy_now_price_cents,
      }).catch(() => {});
    }
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop";
  const now = new Date();

  // Fetch buyer + seller for auto-charge
  const [{ data: buyer }, { data: sellerProfile }] = await Promise.all([
    admin.from("profiles").select("stripe_customer_id, default_payment_method_id, saved_shipping_address").eq("id", user.id).single(),
    admin.from("profiles").select("stripe_account_id, plan, is_admin, groundbreaker").eq("id", auction.seller_id).single(),
  ]);

  const canAutoCharge = !!(
    buyer?.stripe_customer_id &&
    buyer?.default_payment_method_id &&
    sellerProfile?.stripe_account_id
  );

  const { data: winnerAuth } = await admin.auth.admin.getUserById(user.id);
  const winnerEmail = winnerAuth?.user?.email;
  const { data: sellerAuth } = await admin.auth.admin.getUserById(auction.seller_id);
  const sellerEmail = sellerAuth?.user?.email;

  if (canAutoCharge) {
    try {
      // Calculate shipping
      let shippingCents = 0;
      if (auction.free_shipping) {
        shippingCents = 0;
      } else if (auction.shipping_cost_cents) {
        shippingCents = auction.shipping_cost_cents;
      } else if (auction.shipping_weight_oz) {
        const { data: shippingSelection } = await admin
          .from("auction_shipping_selections")
          .select("cost_cents")
          .eq("auction_id", auctionId)
          .eq("bidder_id", user.id)
          .single();
        shippingCents = shippingSelection?.cost_cents ?? 0;
      }

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
        auction.buy_now_price_cents,
        shippingCents,
        stripeShippingAddr,
        auctionId
      ).catch(() => ({ taxCents: 0, calculationId: null }));

      const totalCents = auction.buy_now_price_cents + shippingCents + taxCents;
      const feePercent = planFeePercent(sellerProfile!.plan, !!sellerProfile!.is_admin, !!sellerProfile!.groundbreaker);
      const feeCents = Math.round(auction.buy_now_price_cents * (feePercent / 100));
      const stripeFeeCents = Math.round(totalCents * 0.029) + 30;
      const appFeeAmount = feeCents + stripeFeeCents + taxCents;

      const deadline = new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000);
      const { data: order } = await admin.from("orders").insert({
        buyer_id: user.id,
        seller_id: auction.seller_id,
        auction_id: auctionId,
        shipping_address: buyer!.saved_shipping_address as { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string; country: string } | null,
        amount_cents: totalCents,
        shipping_cost_cents: shippingCents,
        tax_cents: taxCents,
        platform_fee_cents: feeCents,
        payment_deadline_at: deadline.toISOString(),
        status: "pending",
      }).select("id").single();

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
          order_id: order?.id ?? "",
          auction_id: auctionId,
          platform_fee_cents: String(feeCents),
          stripe_fee_cents: String(stripeFeeCents),
          tax_cents: String(taxCents),
          ...(calculationId ? { tax_calculation_id: calculationId } : {}),
        },
      });

      if (order?.id) {
        await admin.from("orders").update({ stripe_payment_intent_id: pi.id }).eq("id", order.id);
      }

      if (winnerEmail) {
        sendAuctionAutoCharged({
          winnerEmail,
          plantName: displayName,
          amountCents: totalCents,
          orderId: order?.id ?? "",
          appUrl,
        }).catch(() => {});
      }

      if (sellerEmail) {
        sendAuctionEndedSeller({
          sellerEmail,
          plantName: displayName,
          winnerFound: true,
          winnerUsername: "The buyer",
          amountCents: auction.buy_now_price_cents,
          ordersUrl: `${appUrl}/orders?tab=sales`,
          autoCharged: true,
        }).catch(() => {});
      }

      return NextResponse.json({ ok: true, autoCharged: true, buyNowCents: auction.buy_now_price_cents, previousBidderId });
    } catch {
      // Auto-charge failed — fall back to manual checkout
    }
  }

  // Fallback: manual checkout
  const checkoutUrl = `${appUrl}/checkout?auction=${auctionId}`;
  const deadline = new Date(now.getTime() + PAYMENT_DEADLINE_HOURS * 60 * 60 * 1000);

  try {
    await admin.from("orders").insert({
      buyer_id: user.id,
      seller_id: auction.seller_id,
      auction_id: auctionId,
      amount_cents: auction.buy_now_price_cents,
      payment_deadline_at: deadline.toISOString(),
      status: "pending",
    });
  } catch { /* best-effort */ }

  if (winnerEmail) {
    sendAuctionPaymentFailed({
      winnerEmail,
      plantName: auction.plant_name,
      amountCents: auction.buy_now_price_cents,
      checkoutUrl,
    }).catch(() => {});
  }

  if (sellerEmail) {
    sendAuctionEndedSeller({
      sellerEmail,
      plantName: auction.plant_name,
      winnerFound: true,
      winnerUsername: "The buyer",
      amountCents: auction.buy_now_price_cents,
      ordersUrl: `${appUrl}/orders?tab=sales`,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, autoCharged: false, checkoutUrl, buyNowCents: auction.buy_now_price_cents, previousBidderId });
}
