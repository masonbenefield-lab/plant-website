import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe, PLATFORM_FEE_PERCENT } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { listingId, auctionId, shippingAddress } = body as {
    listingId?: string;
    auctionId?: string;
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

    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarded")
      .eq("id", listing.seller_id)
      .single();

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const amountCents = listing.price_cents;
    const feeCents = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));

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

    await supabase
      .from("listings")
      .update({
        quantity: listing.quantity - 1,
        status: listing.quantity <= 1 ? "sold_out" : "active",
      })
      .eq("id", listingId);

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

    const { data: sellerProfile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarded")
      .eq("id", auction.seller_id)
      .single();

    if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
      return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
    }

    const amountCents = auction.current_bid_cents;
    const feeCents = Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));

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

    return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id });
  }
}
