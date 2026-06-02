import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { planFeePercent } from "@/lib/plan-limits";
import { createStripeTaxCalculation } from "@/lib/tax";
import {
  sendReserveOfferDeclined,
  sendReserveOfferAccepted,
  sendAuctionPaymentFailed,
} from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auctionId, action } = await request.json() as { auctionId: string; action: "accept" | "decline" };
  if (action !== "accept" && action !== "decline") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = adminClient();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");

  const { data: auction } = await admin
    .from("auctions")
    .select("id, seller_id, plant_name, current_bid_cents, current_bidder_id, reserve_offer_status, reserve_offer_expires_at, free_shipping, shipping_cost_cents, shipping_weight_oz")
    .eq("id", auctionId)
    .single();

  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.current_bidder_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (auction.reserve_offer_status !== "pending") {
    return NextResponse.json({ error: "Offer is no longer active" }, { status: 400 });
  }
  if (auction.reserve_offer_expires_at && new Date(auction.reserve_offer_expires_at) <= new Date()) {
    await admin.from("auctions").update({ reserve_offer_status: "expired" }).eq("id", auctionId);
    return NextResponse.json({ error: "This offer has expired" }, { status: 400 });
  }

  // ── Decline ──────────────────────────────────────────────────────────────────
  if (action === "decline") {
    await admin.from("auctions").update({ reserve_offer_status: "declined" }).eq("id", auctionId);

    const { data: buyerProfile } = await admin.from("profiles").select("username").eq("id", user.id).single();
    const { data: sellerAuth } = await admin.auth.admin.getUserById(auction.seller_id);
    const sellerEmail = sellerAuth?.user?.email;
    if (sellerEmail) {
      await sendReserveOfferDeclined({
        sellerEmail,
        plantName: auction.plant_name,
        buyerUsername: buyerProfile?.username ?? "The buyer",
        bidCents: auction.current_bid_cents,
        dashboardUrl: `${appUrl}/dashboard/auctions`,
      }).catch(() => {});
    }
    return NextResponse.json({ ok: true, action: "declined" });
  }

  // ── Accept — fire auto-charge ─────────────────────────────────────────────
  const { data: buyer } = await admin
    .from("profiles")
    .select("stripe_customer_id, default_payment_method_id, saved_shipping_address")
    .eq("id", user.id)
    .single();

  const { data: sellerProfile } = await admin
    .from("profiles")
    .select("stripe_account_id, plan, is_admin, groundbreaker, ship_from_address")
    .eq("id", auction.seller_id)
    .single();

  if (!buyer?.stripe_customer_id || !buyer?.default_payment_method_id) {
    return NextResponse.json({ error: "payment_method_required" }, { status: 403 });
  }
  if (!sellerProfile?.stripe_account_id) {
    return NextResponse.json({ error: "Seller payment account not set up" }, { status: 400 });
  }

  // Resolve shipping cost
  let shippingCents = 0;
  if (!auction.free_shipping) {
    if (auction.shipping_weight_oz) {
      const { data: sel } = await admin
        .from("auction_shipping_selections")
        .select("cost_cents")
        .eq("auction_id", auctionId)
        .eq("bidder_id", user.id)
        .single();
      shippingCents = sel?.cost_cents ?? 0;
    } else {
      shippingCents = auction.shipping_cost_cents ?? 0;
    }
  }

  const shippingAddr = (buyer.saved_shipping_address ?? {}) as Record<string, string>;
  const stripeShippingAddr = {
    line1: shippingAddr.line1 ?? "",
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
  const feePercent = planFeePercent(sellerProfile.plan, !!sellerProfile.is_admin, !!sellerProfile.groundbreaker);
  const feeCents = Math.round(auction.current_bid_cents * (feePercent / 100));
  const stripeFeeCents = Math.round(totalCents * 0.029) + 30;
  const appFeeAmount = feeCents + stripeFeeCents + taxCents;

  const now = new Date();
  const { data: order } = await admin.from("orders").insert({
    buyer_id: user.id,
    seller_id: auction.seller_id,
    auction_id: auctionId,
    shipping_address: buyer.saved_shipping_address as { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string; country: string } | null,
    amount_cents: totalCents,
    shipping_cost_cents: shippingCents,
    tax_cents: taxCents,
    platform_fee_cents: feeCents,
    payment_deadline_at: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    status: "pending",
  }).select("id").single();

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

    await admin.from("auctions").update({ reserve_offer_status: "accepted" }).eq("id", auctionId);

    const { data: buyerAuth } = await admin.auth.admin.getUserById(user.id);
    const buyerEmail = buyerAuth?.user?.email;
    if (buyerEmail) {
      await sendReserveOfferAccepted({
        buyerEmail,
        plantName: auction.plant_name,
        amountCents: totalCents,
        appUrl,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, action: "accepted", orderId: order?.id });
  } catch {
    // Auto-charge failed — mark offer as accepted but order needs manual payment
    await admin.from("auctions").update({ reserve_offer_status: "accepted" }).eq("id", auctionId);

    const { data: buyerAuth } = await admin.auth.admin.getUserById(user.id);
    const buyerEmail = buyerAuth?.user?.email;
    if (buyerEmail) {
      await sendAuctionPaymentFailed({
        winnerEmail: buyerEmail,
        plantName: auction.plant_name,
        amountCents: totalCents,
        checkoutUrl: `${appUrl}/checkout?auction=${auctionId}`,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, action: "accepted", paymentFailed: true });
  }
}
