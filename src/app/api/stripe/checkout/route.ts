import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { planFeePercent } from "@/lib/plan-limits";
import { sendLowStockAlert } from "@/lib/email";

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
  const { listingId, auctionId, offerId, quantity: rawQty, shippingAddress } = body as {
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
      .eq("status", "active")
      .single();

    if (error || !listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 });
    }

    if (quantity > listing.quantity) {
      return NextResponse.json({ error: `Only ${listing.quantity} available` }, { status: 400 });
    }

    const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
      supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", listing.seller_id).single(),
      supabase.from("profiles").select("plan, is_admin").eq("id", listing.seller_id).single(),
    ]);

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const feePercent = planFeePercent(sellerPlan?.plan, !!sellerPlan?.is_admin);
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
    const amountCents = effectivePriceCents * quantity;
    const feeCents = Math.round(amountCents * (feePercent / 100));

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: feeCents,
      transfer_data: { destination: sellerProfile.stripe_account_id },
    });

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        buyer_id: user.id,
        seller_id: listing.seller_id,
        listing_id: listingId,
        stripe_payment_intent_id: paymentIntent.id,
        shipping_address: shippingAddress,
        amount_cents: amountCents,
      })
      .select()
      .single();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

    // Mark the accepted offer as withdrawn (used) so it can't be checked out twice
    if (offerId) {
      await supabase.from("offers").update({ status: "withdrawn" }).eq("id", offerId);
    }

    const newListingQty = listing.quantity - quantity;
    const soldOut = newListingQty <= 0;
    const soldOutBehavior = (listing as { sold_out_behavior?: string }).sold_out_behavior ?? "mark_sold_out";
    await supabase
      .from("listings")
      .update({
        quantity: newListingQty,
        status: soldOut ? (soldOutBehavior === "auto_pause" ? "paused" : "sold_out") : "active",
      })
      .eq("id", listingId);

    if (listing.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("quantity, listing_quantity, low_stock_threshold, plant_name, variety")
        .eq("id", listing.inventory_id)
        .single();
      if (inv) {
        const newInvListingQty = Math.max(0, (inv.listing_quantity ?? 0) - quantity);
        const newInvQty = Math.max(0, inv.quantity - quantity);
        await supabase.from("inventory").update({
          quantity: newInvQty,
          listing_quantity: newInvListingQty,
          ...(newInvListingQty <= 0 ? { listing_id: null } : {}),
        }).eq("id", listing.inventory_id);

        // Low stock alert
        const threshold = (inv as { low_stock_threshold?: number | null }).low_stock_threshold;
        if (threshold && newInvQty <= threshold && newInvQty > 0) {
          const admin = adminClient();
          const { data: sellerAuth } = await admin.auth.admin.getUserById(listing.seller_id);
          const sellerEmail = sellerAuth?.user?.email;
          if (sellerEmail) {
            sendLowStockAlert({
              sellerEmail,
              plantName: inv.plant_name,
              variety: inv.variety ?? null,
              quantity: newInvQty,
              inventoryId: listing.inventory_id,
            }).catch(() => {});
          }
        }
      }
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id });
  }

  if (auctionId) {
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

    const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
      supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", auction.seller_id).single(),
      supabase.from("profiles").select("plan, is_admin").eq("id", auction.seller_id).single(),
    ]);

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const feePercent = planFeePercent(sellerPlan?.plan, !!sellerPlan?.is_admin);
    const amountCents = auction.current_bid_cents;
    const feeCents = Math.round(amountCents * (feePercent / 100));

    const paymentIntent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      application_fee_amount: feeCents,
      transfer_data: { destination: sellerProfile.stripe_account_id },
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
      })
      .select()
      .single();

    if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

    if (auction.inventory_id) {
      const { data: inv } = await supabase
        .from("inventory")
        .select("quantity")
        .eq("id", auction.inventory_id)
        .single();
      if (inv) {
        await supabase.from("inventory").update({
          quantity: Math.max(0, inv.quantity - (auction.quantity ?? 1)),
          auction_id: null,
          auction_quantity: null,
        }).eq("id", auction.inventory_id);
      }
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id });
  }
}
