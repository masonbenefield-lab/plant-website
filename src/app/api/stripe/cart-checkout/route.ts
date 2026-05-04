import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
import { checkRateLimit } from "@/lib/rate-limit";
import { planFeePercent } from "@/lib/plan-limits";

interface CartItem {
  listingId: string;
  quantity: number;
  priceCents: number; // client-supplied, re-validated server-side
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`checkout:${user.id}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { items, shippingAddress } = await request.json() as {
    items: CartItem[];
    shippingAddress: {
      name: string; line1: string; line2?: string;
      city: string; state: string; zip: string; country: string;
      is_gift?: boolean; gift_message?: string | null;
    };
  };

  if (!items?.length) return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  if (items.length > 20) return NextResponse.json({ error: "Too many items" }, { status: 400 });

  // Fetch all listings, validate they exist, belong to one seller, and have stock
  const listingIds = items.map((i) => i.listingId);
  const { data: listings, error: listErr } = await supabase
    .from("listings")
    .select("id, seller_id, plant_name, variety, price_cents, sale_price_cents, sale_ends_at, quantity, inventory_id, bundle_discount_pct")
    .in("id", listingIds)
    .eq("status", "active");

  if (listErr || !listings?.length) return NextResponse.json({ error: "One or more items unavailable" }, { status: 400 });
  if (listings.length !== items.length) return NextResponse.json({ error: "One or more items not found" }, { status: 400 });

  const sellerIds = [...new Set(listings.map((l) => l.seller_id))];
  if (sellerIds.length > 1) return NextResponse.json({ error: "Cart can only contain items from one seller" }, { status: 400 });

  const sellerId = sellerIds[0];

  // Validate quantities and compute totals
  const cartItemsForOrder: { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] = [];
  let totalCents = 0;

  for (const cartItem of items) {
    const listing = listings.find((l) => l.id === cartItem.listingId);
    if (!listing) return NextResponse.json({ error: "Item not found" }, { status: 400 });
    if (cartItem.quantity < 1) return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    if (cartItem.quantity > listing.quantity) {
      return NextResponse.json({ error: `Only ${listing.quantity} of ${listing.plant_name} available` }, { status: 400 });
    }
    const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
    const basePriceCents = onSale ? listing.sale_price_cents! : listing.price_cents;
    const bundlePct = (listing as { bundle_discount_pct?: number | null }).bundle_discount_pct ?? 0;
    const priceCents = (bundlePct && cartItem.quantity >= 2)
      ? Math.round(basePriceCents * (1 - bundlePct / 100))
      : basePriceCents;
    totalCents += priceCents * cartItem.quantity;
    cartItemsForOrder.push({
      listing_id: listing.id,
      plant_name: listing.plant_name,
      variety: listing.variety ?? null,
      quantity: cartItem.quantity,
      price_cents: priceCents,
    });
  }

  const [{ data: sellerProfile }, { data: sellerPlan }] = await Promise.all([
    supabase.from("profiles").select("stripe_account_id, stripe_onboarded").eq("id", sellerId).single(),
    supabase.from("profiles").select("plan, is_admin").eq("id", sellerId).single(),
  ]);

  if (!sellerProfile?.stripe_onboarded || !sellerProfile.stripe_account_id) {
    return NextResponse.json({ error: "Seller not set up for payments" }, { status: 400 });
  }

  const feePercent = planFeePercent(sellerPlan?.plan, !!sellerPlan?.is_admin);
  const feeCents = Math.round(totalCents * (feePercent / 100));

  const paymentIntent = await getStripe().paymentIntents.create({
    amount: totalCents,
    currency: "usd",
    application_fee_amount: feeCents,
    transfer_data: { destination: sellerProfile.stripe_account_id },
  });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      buyer_id: user.id,
      seller_id: sellerId,
      stripe_payment_intent_id: paymentIntent.id,
      shipping_address: shippingAddress,
      amount_cents: totalCents,
      cart_items: cartItemsForOrder,
    })
    .select()
    .single();

  if (orderError) return NextResponse.json({ error: orderError.message }, { status: 500 });

  // Decrement stock for each item
  for (const cartItem of items) {
    const listing = listings.find((l) => l.id === cartItem.listingId)!;
    const newQty = listing.quantity - cartItem.quantity;
    await supabase.from("listings").update({
      quantity: newQty,
      status: newQty <= 0 ? "sold_out" : "active",
    }).eq("id", listing.id);

    if (listing.inventory_id) {
      const { data: inv } = await supabase.from("inventory").select("quantity, listing_quantity").eq("id", listing.inventory_id).single();
      if (inv) {
        const newListingQty = Math.max(0, (inv.listing_quantity ?? 0) - cartItem.quantity);
        await supabase.from("inventory").update({
          quantity: Math.max(0, inv.quantity - cartItem.quantity),
          listing_quantity: newListingQty,
          ...(newListingQty <= 0 ? { listing_id: null } : {}),
        }).eq("id", listing.inventory_id);
      }
    }
  }

  return NextResponse.json({ clientSecret: paymentIntent.client_secret, orderId: order.id });
}
