import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { planFeePercent, type Plan } from "@/lib/plan-limits";
import { sendLowStockAlert } from "@/lib/email";
import { isBlocked } from "@/lib/blocks";
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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`checkout:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const body = await request.json();
  const { listingId, auctionId, offerId, quantity: rawQty, shippingAddress, shippingCostCents, shippingService, buyerNote } = body as {
    listingId?: string;
    auctionId?: string;
    offerId?: string;
    quantity?: number;
    shippingAddress: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
    shippingCostCents?: number;
    shippingService?: string;
    buyerNote?: string;
  };

  const quantity = Math.max(1, Math.floor(rawQty ?? 1));

  if (!listingId && !auctionId) {
    return NextResponse.json({ error: "listing or auction required" }, { status: 400 });
  }

  if (listingId) {
    const { data: listing, error } = await supabase
      .from("listings")
      .select("*")
      .eq("id", listingId)
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (listing.status !== "active") {
      return NextResponse.json({
        error: listing.status === "sold_out"
          ? "This item is sold out"
          : "This listing is no longer available",
      }, { status: 410 });
    }

    if (listing.seller_id === user.id) {
      return NextResponse.json({ error: "You cannot purchase your own listing" }, { status: 400 });
    }

    if (await isBlocked(user.id, listing.seller_id)) {
      return NextResponse.json({ error: "This listing is unavailable." }, { status: 403 });
    }

    if (quantity > listing.quantity) {
      return NextResponse.json({ error: `Only ${listing.quantity} available` }, { status: 400 });
    }

    const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
      supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", listing.seller_id).single(),
      supabase.from("profiles").select("plan, is_admin, groundbreaker").eq("id", listing.seller_id).single(),
    ]);

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const feePercent = planFeePercent(sellerPlan?.plan as Plan | null, !!sellerPlan?.is_admin, !!sellerPlan?.groundbreaker);
    // If checking out with an accepted offer, use offer price
    let effectivePriceCents: number;
    if (offerId) {
      const { data: offer } = await supabase
        .from("offers")
        .select("amount_cents, buyer_id, status, expires_at")
        .eq("id", offerId)
        .eq("listing_id", listingId)
        .single();
      if (!offer || offer.buyer_id !== user.id || offer.status !== "accepted" || new Date(offer.expires_at) < new Date()) {
        return NextResponse.json({ error: "Offer is invalid or expired" }, { status: 400 });
      }
      effectivePriceCents = offer.amount_cents;
    } else {
      const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
      effectivePriceCents = onSale ? listing.sale_price_cents! : listing.price_cents;
    }
    const itemAmountCents = effectivePriceCents * quantity;
    const shippingCents = Math.max(0, Math.round(shippingCostCents ?? 0));
    const { taxCents, calculationId } = await createStripeTaxCalculation(
      itemAmountCents,
      shippingCents,
      shippingAddress,
      listingId
    );
    const amountCents = itemAmountCents + shippingCents + taxCents;
    const feeCents = Math.round(itemAmountCents * (feePercent / 100));
    // Stripe processing fee estimate (2.9% + $0.30) — passed through to seller via application fee
    const stripeFeeCents = Math.round(amountCents * 0.029) + 30;
    const applicationFeeCents = feeCents + stripeFeeCents + taxCents;

    const admin = adminClient();
    const newListingQty = listing.quantity - quantity;
    const soldOut = newListingQty <= 0;
    const soldOutBehavior = (listing as { sold_out_behavior?: string }).sold_out_behavior ?? "mark_sold_out";

    // Atomically decrement stock before creating PaymentIntent — prevents two buyers from purchasing the same last unit
    const { data: decremented } = await admin
      .from("listings")
      .update({
        quantity: newListingQty,
        status: soldOut ? (soldOutBehavior === "auto_pause" ? "paused" : "sold_out") : "active",
      })
      .eq("id", listingId)
      .gte("quantity", quantity)
      .select("id");

    if (!decremented?.length) {
      return NextResponse.json({ error: "This item just sold out — someone else got the last one." }, { status: 409 });
    }

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: applicationFeeCents,
      on_behalf_of: sellerProfile.stripe_account_id,
      transfer_data: { destination: sellerProfile.stripe_account_id },
      metadata: {
        listing_id: listingId,
        listing_qty: String(quantity),
        platform_fee_cents: String(feeCents),
        stripe_fee_cents: String(stripeFeeCents),
        tax_cents: String(taxCents),
        ...(calculationId ? { tax_calculation_id: calculationId } : {}),
        ...(listing.inventory_id ? { inventory_id: listing.inventory_id } : {}),
      },
    }).catch(async (err) => {
      await admin.from("listings").update({ quantity: listing.quantity, status: "active" }).eq("id", listingId);
      throw err;
    });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert({
        buyer_id: user.id,
        seller_id: listing.seller_id,
        listing_id: listingId,
        stripe_payment_intent_id: paymentIntent.id,
        shipping_address: shippingAddress,
        amount_cents: amountCents,
        shipping_cost_cents: shippingCents,
        shipping_service: shippingService ?? null,
        platform_fee_cents: feeCents,
        tax_cents: taxCents,
        ...(buyerNote?.trim() ? { buyer_note: buyerNote.trim() } : {}),
        item_snapshot: {
          plant_name: listing.plant_name,
          variety: listing.variety ?? null,
          image: (listing.images as string[] | null)?.[0] ?? null,
        },
      } as any)
      .select()
      .single();

    if (orderError) {
      await admin.from("listings").update({ quantity: listing.quantity, status: "active" }).eq("id", listingId);
      await getStripe().paymentIntents.cancel(paymentIntent.id).catch(() => {});
      return NextResponse.json({ error: orderError.message }, { status: 500 });
    }

    // Mark the accepted offer as withdrawn (used) so it can't be checked out twice
    if (offerId) {
      await supabase.from("offers").update({ status: "withdrawn" }).eq("id", offerId);
    }

    // Look up inventory by inventory_id (preferred) or by listing_id (fallback for older listings)
    const invQuery = listing.inventory_id
      ? admin.from("inventory").select("id, quantity, listing_quantity, low_stock_threshold, plant_name, variety").eq("id", listing.inventory_id).single()
      : admin.from("inventory").select("id, quantity, listing_quantity, low_stock_threshold, plant_name, variety").eq("listing_id", listingId).maybeSingle();

    const { data: inv } = await invQuery;
    if (inv) {
      const invId: string = (inv as { id: string }).id;
      const newInvListingQty = Math.max(0, (inv.listing_quantity ?? 0) - quantity);
      const newInvQty = Math.max(0, inv.quantity - quantity);
      await admin.from("inventory").update({
        quantity: newInvQty,
        listing_quantity: newInvListingQty,
      }).eq("id", invId);

      // Low stock alert
      const threshold = (inv as { low_stock_threshold?: number | null }).low_stock_threshold;
      if (threshold && newInvQty <= threshold && newInvQty > 0) {
        const { data: sellerAuth } = await admin.auth.admin.getUserById(listing.seller_id);
        const sellerEmail = sellerAuth?.user?.email;
        if (sellerEmail) {
          sendLowStockAlert({
            sellerEmail,
            plantName: inv.plant_name,
            variety: inv.variety ?? null,
            quantity: newInvQty,
            inventoryId: invId,
          }).catch(() => {});
        }
      }
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id, taxCents });
  }

  if (auctionId) {
    const admin = adminClient();

    // Second-bidder offer: offerId points to a pre-created pending order
    if (offerId) {
      const { data: offerOrder } = await supabase
        .from("orders")
        .select("id, seller_id, auction_id, amount_cents, stripe_payment_intent_id, payment_deadline_at")
        .eq("id", offerId)
        .eq("auction_id", auctionId)
        .eq("buyer_id", user.id)
        .eq("status", "pending")
        .single();

      if (!offerOrder) return NextResponse.json({ error: "Offer not found or expired" }, { status: 404 });
      if (offerOrder.payment_deadline_at && new Date(offerOrder.payment_deadline_at) < new Date()) {
        return NextResponse.json({ error: "This offer has expired" }, { status: 410 });
      }

      // Reuse existing PI if already created (double-tap guard)
      if (offerOrder.stripe_payment_intent_id) {
        const existingPi = await getStripe().paymentIntents.retrieve(offerOrder.stripe_payment_intent_id);
        if (existingPi.status !== "canceled") {
          return NextResponse.json({ clientSecret: existingPi.client_secret, orderId: offerOrder.id, taxCents: 0 });
        }
      }

      const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
        supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", offerOrder.seller_id).single(),
        supabase.from("profiles").select("plan, is_admin, groundbreaker").eq("id", offerOrder.seller_id).single(),
      ]);

      if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
        return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
      }

      const feePercent = planFeePercent(sellerPlan?.plan as Plan | null, !!sellerPlan?.is_admin, !!sellerPlan?.groundbreaker);
      const offerShippingCents = Math.max(0, Math.round(shippingCostCents ?? 0));
      const { taxCents: offerTaxCents, calculationId: offerCalcId } = await createStripeTaxCalculation(
        offerOrder.amount_cents,
        offerShippingCents,
        shippingAddress,
        auctionId
      );
      const offerTotalCents = offerOrder.amount_cents + offerShippingCents + offerTaxCents;
      const offerFeeCents = Math.round(offerOrder.amount_cents * (feePercent / 100));
      const offerStripeFeeCents = Math.round(offerTotalCents * 0.029) + 30;
      const offerApplicationFeeCents = offerFeeCents + offerStripeFeeCents + offerTaxCents;

      const paymentIntent = await getStripe().paymentIntents.create({
        amount: offerTotalCents,
        currency: "usd",
        application_fee_amount: offerApplicationFeeCents,
        on_behalf_of: sellerProfile.stripe_account_id,
        transfer_data: { destination: sellerProfile.stripe_account_id },
        metadata: {
          auction_id: auctionId,
          platform_fee_cents: String(offerFeeCents),
          stripe_fee_cents: String(offerStripeFeeCents),
          tax_cents: String(offerTaxCents),
          ...(offerCalcId ? { tax_calculation_id: offerCalcId } : {}),
        },
      });

      const { error: updateError } = await admin
        .from("orders")
        .update({
          stripe_payment_intent_id: paymentIntent.id,
          shipping_address: shippingAddress,
          amount_cents: offerTotalCents,
          shipping_cost_cents: offerShippingCents,
          shipping_service: shippingService ?? null,
          platform_fee_cents: offerFeeCents,
          tax_cents: offerTaxCents,
        })
        .eq("id", offerId);

      if (updateError) {
        await getStripe().paymentIntents.cancel(paymentIntent.id).catch(() => {});
        return NextResponse.json({ error: updateError.message }, { status: 500 });
      }

      return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: offerOrder.id, taxCents: offerTaxCents });
    }

    // Normal winner checkout
    const { data: auction, error } = await supabase
      .from("auctions")
      .select("*")
      .eq("id", auctionId)
      .eq("status", "ended")
      .eq("current_bidder_id", user.id)
      .single();

    if (error || !auction) {
      return NextResponse.json({ error: "Auction not found or not eligible" }, { status: 404 });
    }

    if (await isBlocked(user.id, auction.seller_id)) {
      return NextResponse.json({ error: "This auction is unavailable." }, { status: 403 });
    }

    // Guard: if the winner already has a pending order + PaymentIntent, reuse it
    const { data: existingOrder } = await supabase
      .from("orders")
      .select("id, stripe_payment_intent_id")
      .eq("auction_id", auctionId)
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .maybeSingle();

    if (existingOrder?.stripe_payment_intent_id) {
      const existingPi = await getStripe().paymentIntents.retrieve(existingOrder.stripe_payment_intent_id);
      if (existingPi.status !== "canceled") {
        return NextResponse.json({ clientSecret: existingPi.client_secret, orderId: existingOrder.id, taxCents: 0 });
      }
    }

    const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
      supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", auction.seller_id).single(),
      supabase.from("profiles").select("plan, is_admin, groundbreaker").eq("id", auction.seller_id).single(),
    ]);

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const feePercent = planFeePercent(sellerPlan?.plan as Plan | null, !!sellerPlan?.is_admin, !!sellerPlan?.groundbreaker);
    const auctionShippingCents = Math.max(0, Math.round(shippingCostCents ?? 0));
    const { taxCents: auctionTaxCents, calculationId: auctionCalcId } = await createStripeTaxCalculation(
      auction.current_bid_cents,
      auctionShippingCents,
      shippingAddress,
      auctionId
    );
    const amountCents = auction.current_bid_cents + auctionShippingCents + auctionTaxCents;
    const feeCents = Math.round(auction.current_bid_cents * (feePercent / 100));
    const stripeFeeCents = Math.round(amountCents * 0.029) + 30;
    const auctionApplicationFeeCents = feeCents + stripeFeeCents + auctionTaxCents;

    const paymentDeadline = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: auctionApplicationFeeCents,
      on_behalf_of: sellerProfile.stripe_account_id,
      transfer_data: { destination: sellerProfile.stripe_account_id },
      metadata: {
        auction_id: auctionId,
        platform_fee_cents: String(feeCents),
        stripe_fee_cents: String(stripeFeeCents),
        tax_cents: String(auctionTaxCents),
        ...(auctionCalcId ? { tax_calculation_id: auctionCalcId } : {}),
      },
    });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: auction.seller_id,
        auction_id: auctionId,
        stripe_payment_intent_id: paymentIntent.id,
        shipping_address: shippingAddress,
        amount_cents: amountCents,
        shipping_cost_cents: auctionShippingCents,
        shipping_service: shippingService ?? null,
        platform_fee_cents: feeCents,
        tax_cents: auctionTaxCents,
        payment_deadline_at: paymentDeadline,
        item_snapshot: {
          plant_name: auction.plant_name,
          variety: auction.variety ?? null,
          image: (auction.images as string[] | null)?.[0] ?? null,
        },
      })
      .select()
      .single();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id, taxCents: auctionTaxCents });
  }
}
