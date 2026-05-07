import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOrderConfirmation, sendNewOrderAlert } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function restoreListingStock(
  supabase: ReturnType<typeof adminClient>,
  listingId: string,
  qty: number,
  inventoryId?: string | null
) {
  const { data: listing } = await supabase
    .from("listings")
    .select("quantity, status")
    .eq("id", listingId)
    .single();
  if (!listing) return;

  await supabase
    .from("listings")
    .update({
      quantity: listing.quantity + qty,
      // Re-activate if the purchase marked it sold_out; leave seller-paused listings alone
      ...(listing.status === "sold_out" ? { status: "active" } : {}),
    })
    .eq("id", listingId);

  if (inventoryId) {
    const { data: inv } = await supabase
      .from("inventory")
      .select("quantity, listing_quantity")
      .eq("id", inventoryId)
      .single();
    if (inv) {
      await supabase
        .from("inventory")
        .update({
          quantity: inv.quantity + qty,
          listing_quantity: Math.max(0, (inv.listing_quantity ?? 0) + qty),
        })
        .eq("id", inventoryId);
    }
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminClient();

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    const { data: order } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", pi.id)
      .select("id, buyer_id, seller_id, amount_cents, listing_id, auction_id, shipping_address")
      .single();

    if (order) {
      // Delete any other pending orders from the same buyer for the same item (ghost duplicates)
      await supabase
        .from("orders")
        .delete()
        .eq("buyer_id", order.buyer_id)
        .eq("status", "pending")
        .neq("id", order.id)
        .eq(order.listing_id ? "listing_id" : "auction_id", order.listing_id ?? order.auction_id ?? "");

      let plantName = "your plant";
      if (order.listing_id) {
        const { data: listing } = await supabase.from("listings").select("plant_name").eq("id", order.listing_id).single();
        if (listing) plantName = listing.plant_name;
      } else if (order.auction_id) {
        const { data: auction } = await supabase.from("auctions").select("plant_name").eq("id", order.auction_id).single();
        if (auction) plantName = auction.plant_name;
      }

      const { data: { user: buyer } } = await supabase.auth.admin.getUserById(order.buyer_id);
      if (buyer?.email) {
        await sendOrderConfirmation({ buyerEmail: buyer.email, plantName, amountCents: order.amount_cents, orderId: order.id }).catch(() => {});
      }

      // Notify seller
      const { data: { user: seller } } = await supabase.auth.admin.getUserById(order.seller_id);
      if (seller?.email && order.shipping_address) {
        const addr = order.shipping_address as { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string };
        await sendNewOrderAlert({
          sellerEmail: seller.email,
          plantName,
          amountCents: order.amount_cents,
          orderId: order.id,
          buyerName: addr.name,
          shippingAddress: addr,
        }).catch(() => {});
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    const { data: order } = await supabase
      .from("orders")
      .select("id, listing_id, auction_id, cart_items")
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "pending")
      .single();

    if (order) {
      // Single-listing checkout: restore via PI metadata (stored at checkout time)
      if (order.listing_id && pi.metadata?.listing_qty) {
        await restoreListingStock(
          supabase,
          order.listing_id,
          Number(pi.metadata.listing_qty),
          pi.metadata.inventory_id ?? null
        );
      }

      // Cart checkout: restore each item using the order's cart_items record
      if (!order.listing_id && !order.auction_id && order.cart_items) {
        const cartItems = order.cart_items as { listing_id: string; quantity: number }[];
        for (const item of cartItems) {
          const { data: listing } = await supabase
            .from("listings")
            .select("inventory_id")
            .eq("id", item.listing_id)
            .single();
          await restoreListingStock(supabase, item.listing_id, item.quantity, listing?.inventory_id ?? null);
        }
      }

      await supabase.from("orders").delete().eq("id", order.id);
    }
  }

  // Subscription created via Checkout — update plan and store IDs
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    if (session.mode === "subscription" && session.metadata?.supabase_user_id) {
      const userId = session.metadata.supabase_user_id;
      const plan = session.metadata.plan as "grower" | "nursery";
      const subscriptionId = session.subscription as string;
      await supabase
        .from("profiles")
        .update({ plan, stripe_subscription_id: subscriptionId, stripe_customer_id: session.customer as string })
        .eq("id", userId);
    }
  }

  // Subscription updated (upgrade/downgrade via portal)
  if (event.type === "customer.subscription.updated") {
    const sub = event.data.object;
    const userId = sub.metadata?.supabase_user_id;
    if (userId && sub.items?.data?.[0]?.price?.id) {
      const priceId = sub.items.data[0].price.id;
      let plan: "grower" | "nursery" | "seedling" = "seedling";
      if (priceId === process.env.STRIPE_GROWER_PRICE_ID || priceId === process.env.STRIPE_GROWER_ANNUAL_PRICE_ID) plan = "grower";
      if (priceId === process.env.STRIPE_NURSERY_PRICE_ID || priceId === process.env.STRIPE_NURSERY_ANNUAL_PRICE_ID) plan = "nursery";
      await supabase.from("profiles").update({ plan, stripe_subscription_id: sub.id }).eq("id", userId);
    }
  }

  // Subscription cancelled — revert to seedling
  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object;
    const userId = sub.metadata?.supabase_user_id;
    if (userId) {
      await supabase.from("profiles").update({ plan: "seedling", stripe_subscription_id: null }).eq("id", userId);
    }
  }

  // When a charge is fully refunded, mark the order as refunded.
  // Stripe Connect automatically reverses the application fee on full refunds,
  // so the platform commission is returned to the seller without extra handling.
  if (event.type === "charge.refunded") {
    const charge = event.data.object;
    if (charge.refunded && charge.payment_intent) {
      await supabase
        .from("orders")
        .update({ status: "refunded" })
        .eq("stripe_payment_intent_id", charge.payment_intent as string)
        .neq("status", "refunded");
    }
  }

  return NextResponse.json({ received: true });
}
