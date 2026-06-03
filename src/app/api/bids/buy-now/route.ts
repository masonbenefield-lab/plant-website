import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOutbidNotification, sendAuctionAutoCharged, sendAuctionEndedSeller } from "@/lib/email";
import { getStripe } from "@/lib/stripe";
import { planFeePercent } from "@/lib/plan-limits";
import { createStripeTaxCalculation } from "@/lib/tax";

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

  const {
    auctionId,
    shippingRateId,
    shippingService,
    shippingCarrier,
    shippingCostCents: bodyShippingCents,
    estimatedDays,
  } = await request.json() as {
    auctionId: string;
    shippingRateId?: string | null;
    shippingService?: string | null;
    shippingCarrier?: string | null;
    shippingCostCents?: number | null;
    estimatedDays?: number | null;
  };

  const admin = adminClient();

  const [{ data: buyer }, { data: auction, error: auctionErr }] = await Promise.all([
    admin.from("profiles").select("stripe_customer_id, default_payment_method_id, saved_shipping_address").eq("id", user.id).single(),
    admin.from("auctions").select("id, seller_id, plant_name, variety, images, current_bid_cents, current_bidder_id, buy_now_price_cents, status, ends_at, free_shipping, shipping_cost_cents, shipping_weight_oz, inventory_id").eq("id", auctionId).single(),
  ]);

  if (auctionErr || !auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.status !== "active") return NextResponse.json({ error: "Auction is not active" }, { status: 400 });
  if (!auction.buy_now_price_cents) return NextResponse.json({ error: "No buy now price set" }, { status: 400 });
  if (auction.seller_id === user.id) return NextResponse.json({ error: "You can't buy your own auction" }, { status: 400 });

  if (!buyer?.default_payment_method_id) {
    return NextResponse.json({ error: "Add a payment method before buying" }, { status: 403 });
  }
  if (!auction.free_shipping && !buyer.saved_shipping_address) {
    return NextResponse.json({ error: "Add a shipping address in Account Settings before buying" }, { status: 403 });
  }
  if (auction.shipping_weight_oz) {
    if (!shippingRateId || bodyShippingCents == null) {
      return NextResponse.json({ error: "Select a shipping rate before buying" }, { status: 400 });
    }
    await admin.from("auction_shipping_selections").upsert({
      auction_id: auctionId,
      bidder_id: user.id,
      rate_id: shippingRateId,
      service: shippingService ?? null,
      carrier: shippingCarrier ?? null,
      cost_cents: bodyShippingCents,
      estimated_days: estimatedDays ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: "auction_id,bidder_id" });
  }

  // Fetch seller profile before locking the auction — if they have no Stripe account
  // we can't charge, so block buy now before touching auction state
  const { data: sellerProfile } = await admin
    .from("profiles")
    .select("stripe_account_id, plan, is_admin, groundbreaker")
    .eq("id", auction.seller_id)
    .single();

  if (!buyer.stripe_customer_id || !sellerProfile?.stripe_account_id) {
    return NextResponse.json({ error: "Buy Now is not available for this auction right now." }, { status: 400 });
  }

  const previousBidderId = auction.current_bidder_id;
  const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop";
  const now = new Date();

  // Lock the auction atomically — only succeeds if status is still "active".
  // Two simultaneous Buy Now requests will race here; only one will match the row.
  const { data: locked, error: updateError } = await admin
    .from("auctions")
    .update({ current_bid_cents: auction.buy_now_price_cents, current_bidder_id: user.id, status: "ended" })
    .eq("id", auctionId)
    .eq("status", "active")
    .select("id");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!locked?.length) return NextResponse.json({ error: "This auction is no longer available." }, { status: 409 });

  // Record the bid only after we've confirmed we hold the lock
  const { error: bidError } = await admin.from("bids").insert({
    auction_id: auctionId,
    bidder_id: user.id,
    amount_cents: auction.buy_now_price_cents,
  });
  if (bidError) return NextResponse.json({ error: bidError.message }, { status: 500 });

  // Calculate amounts
  let shippingCents = 0;
  if (auction.free_shipping) {
    shippingCents = 0;
  } else if (auction.shipping_cost_cents) {
    shippingCents = auction.shipping_cost_cents;
  } else if (auction.shipping_weight_oz) {
    const { data: sel } = await admin
      .from("auction_shipping_selections")
      .select("cost_cents")
      .eq("auction_id", auctionId)
      .eq("bidder_id", user.id)
      .single();
    shippingCents = sel?.cost_cents ?? 0;
  }

  const shippingAddr = (buyer.saved_shipping_address ?? {}) as Record<string, string>;
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
  const feePercent = planFeePercent(sellerProfile.plan, !!sellerProfile.is_admin, !!sellerProfile.groundbreaker);
  const feeCents = Math.round(auction.buy_now_price_cents * (feePercent / 100));
  const stripeFeeCents = Math.round(totalCents * 0.029) + 30;
  const platformShipping = auction.shipping_weight_oz ? shippingCents : 0;
  const appFeeAmount = feeCents + stripeFeeCents + taxCents + platformShipping;

  // Attempt charge
  try {
    const pi = await getStripe().paymentIntents.create({
      amount: totalCents,
      currency: "usd",
      customer: buyer.stripe_customer_id!,
      payment_method: buyer.default_payment_method_id!,
      confirm: true,
      off_session: true,
      on_behalf_of: sellerProfile.stripe_account_id!,
      transfer_data: { destination: sellerProfile.stripe_account_id! },
      application_fee_amount: appFeeAmount,
      metadata: {
        auction_id: auctionId,
        auto_charged: "true",
        platform_fee_cents: String(feeCents),
        stripe_fee_cents: String(stripeFeeCents),
        tax_cents: String(taxCents),
        ...(calculationId ? { tax_calculation_id: calculationId } : {}),
      },
    });

    // Charge succeeded — create order and send emails
    const { data: order } = await admin.from("orders").insert({
      buyer_id: user.id,
      seller_id: auction.seller_id,
      auction_id: auctionId,
      stripe_payment_intent_id: pi.id,
      shipping_address: buyer.saved_shipping_address as { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string; country: string } | null,
      amount_cents: totalCents,
      shipping_cost_cents: shippingCents,
      tax_cents: taxCents,
      platform_fee_cents: feeCents,
      shippo_rate_id: shippingRateId ?? null,
      status: "pending",
      item_snapshot: {
        plant_name: auction.plant_name,
        variety: auction.variety ?? null,
        image: (auction.images as string[] | null)?.[0] ?? null,
      },
    }).select("id").single();

    const { data: winnerAuth } = await admin.auth.admin.getUserById(user.id);
    const winnerEmail = winnerAuth?.user?.email;
    const { data: sellerAuth } = await admin.auth.admin.getUserById(auction.seller_id);
    const sellerEmail = sellerAuth?.user?.email;

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
        amountCents: totalCents,
        ordersUrl: `${appUrl}/orders?tab=sales`,
        autoCharged: true,
      }).catch(() => {});
    }

    // Notify previous bidder the auction was purchased via Buy Now
    if (previousBidderId && previousBidderId !== user.id) {
      const { data: prevAuth } = await admin.auth.admin.getUserById(previousBidderId);
      const prevEmail = prevAuth?.user?.email;
      if (prevEmail) {
        sendOutbidNotification({
          bidderEmail: prevEmail,
          plantName: displayName,
          auctionId,
          newBidCents: auction.buy_now_price_cents,
          buyNow: true,
        }).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, autoCharged: true, buyNowCents: auction.buy_now_price_cents, previousBidderId });

  } catch {
    // Charge failed — revert auction to active so other bidders can still participate
    await admin.from("auctions").update({
      status: "active",
      current_bidder_id: previousBidderId,
      current_bid_cents: auction.current_bid_cents,
    }).eq("id", auctionId);

    // Remove the bid record since buy now didn't complete
    await admin.from("bids").delete()
      .eq("auction_id", auctionId)
      .eq("bidder_id", user.id)
      .eq("amount_cents", auction.buy_now_price_cents);

    // Clear the declined card so the buyer must update it before bidding again
    await admin.from("profiles").update({ default_payment_method_id: null }).eq("id", user.id);

    return NextResponse.json({
      error: "payment_declined",
      message: "Your payment was declined. Please update your card in Account Settings and try again.",
    }, { status: 402 });
  }
}
