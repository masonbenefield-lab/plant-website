import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOrderConfirmation, sendNewOrderAlert, sendLowStockAlert, sendOversellRefund } from "@/lib/email";

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
          listing_id: listingId,
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
      .eq("status", "pending")
      .select("id, buyer_id, seller_id, amount_cents, listing_id, auction_id, shipping_address, cart_items")
      .single();

    if (order) {
      // Record the Stripe Tax transaction so it appears in Tax → Transactions
      const taxCalculationId = pi.metadata?.tax_calculation_id;
      if (taxCalculationId) {
        getStripe().tax.transactions.createFromCalculation({
          calculation: taxCalculationId,
          reference: order.id,
        }).catch((err) => console.error("[StripeTax] Failed to record transaction:", err));
      }

      // Delete any other pending orders from the same buyer for the same item (ghost duplicates)
      await supabase
        .from("orders")
        .delete()
        .eq("buyer_id", order.buyer_id)
        .eq("status", "pending")
        .neq("id", order.id)
        .eq(order.listing_id ? "listing_id" : "auction_id", order.listing_id ?? order.auction_id ?? "");

      let plantName = "your plant";
      let emailItems: { name: string; quantity: number }[] | undefined;

      if (order.listing_id) {
        const { data: listing } = await supabase.from("listings").select("plant_name, variety").eq("id", order.listing_id).single();
        if (listing) plantName = listing.variety ? `${listing.plant_name} — ${listing.variety}` : listing.plant_name;
      } else if (order.auction_id) {
        const { data: auction } = await supabase.from("auctions").select("plant_name, variety").eq("id", order.auction_id).single();
        if (auction) plantName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
      } else if (order.cart_items) {
        const ci = order.cart_items as { plant_name: string; variety: string | null; quantity: number }[];
        emailItems = ci.map((c) => ({
          name: c.variety ? `${c.plant_name} — ${c.variety}` : c.plant_name,
          quantity: c.quantity,
        }));
        plantName = ci.length === 1
          ? emailItems[0].name
          : `${ci[0].plant_name} + ${ci.length - 1} more`;
      }

      // Auto-charged auction orders already had emails sent by the close/buy-now route.
      // Manual checkout (failed auto-charge fallback) needs emails sent here.
      const isAutoChargedAuction = !!order.auction_id && pi.metadata?.auto_charged === "true";

      const { data: { user: buyer } } = await supabase.auth.admin.getUserById(order.buyer_id);
      if (buyer?.email && !isAutoChargedAuction) {
        await sendOrderConfirmation({ buyerEmail: buyer.email, plantName, amountCents: order.amount_cents, orderId: order.id, items: emailItems }).catch(() => {});
      }

      // Notify seller
      const { data: { user: seller } } = await supabase.auth.admin.getUserById(order.seller_id);
      if (seller?.email && order.shipping_address && !isAutoChargedAuction) {
        const addr = order.shipping_address as { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string };
        await sendNewOrderAlert({
          sellerEmail: seller.email,
          plantName,
          amountCents: order.amount_cents,
          orderId: order.id,
          buyerName: addr.name,
          shippingAddress: addr,
          items: emailItems,
        }).catch(() => {});
      }

      // First-sale referral bonus: if this seller was referred and hasn't sold before, activate +2 entry
      {
        const { data: sellerProfile } = await supabase
          .from("profiles")
          .select("referred_by")
          .eq("id", order.seller_id)
          .single();
        if (sellerProfile?.referred_by) {
          await supabase
            .from("referral_activations")
            .insert({ referrer_id: sellerProfile.referred_by, referred_id: order.seller_id, type: "first_sale" })
            .catch(() => {}); // 23505 unique violation = already fired, idempotent
        }
      }

      // Cart checkout: decrement listing stock and inventory now that payment is confirmed
      if (pi.metadata?.cart_checkout === "true" && order.cart_items) {
        const cartItems = order.cart_items as { listing_id: string; quantity: number }[];

        // Batch-fetch all listings upfront so we can pre-check for oversells
        // before touching any stock. Two buyers racing on a last-in-stock item
        // can both reach this point; the one whose webhook runs second will find
        // quantity already at 0 and trigger a full refund.
        const { data: allListings } = await supabase
          .from("listings")
          .select("id, quantity, status, inventory_id, sold_out_behavior, seller_id")
          .in("id", cartItems.map((ci) => ci.listing_id));

        const listingById = Object.fromEntries((allListings ?? []).map((l) => [l.id, l]));
        const oversoldItem = cartItems.find((ci) => {
          const l = listingById[ci.listing_id];
          return !l || l.quantity < ci.quantity;
        });

        if (oversoldItem) {
          // Someone else bought the last unit — refund this buyer in full
          console.error(`[Webhook] Oversell detected on order ${order.id}, issuing refund`);
          await getStripe().refunds.create({ payment_intent: pi.id }).catch((err) =>
            console.error("[Webhook] Refund failed:", err)
          );
          await supabase.from("orders").update({ status: "refunded" }).eq("id", order.id);
          const { data: { user: buyerUser } } = await supabase.auth.admin.getUserById(order.buyer_id);
          if (buyerUser?.email && emailItems?.length) {
            sendOversellRefund({ buyerEmail: buyerUser.email, amountCents: order.amount_cents, items: emailItems }).catch(() => {});
          }
        } else {
          for (const cartItem of cartItems) {
            const listing = listingById[cartItem.listing_id];
            if (!listing) continue;

            const newQty = listing.quantity - cartItem.quantity;
            const soldOut = newQty <= 0;
            const soldOutBehavior = (listing as { sold_out_behavior?: string }).sold_out_behavior ?? "mark_sold_out";
            await supabase
              .from("listings")
              .update({
                quantity: newQty,
                status: soldOut ? (soldOutBehavior === "auto_pause" ? "paused" : "sold_out") : "active",
              })
              .eq("id", listing.id);

            // Update linked inventory
            const invQuery = listing.inventory_id
              ? supabase.from("inventory").select("id, quantity, listing_quantity, low_stock_threshold, plant_name, variety").eq("id", listing.inventory_id).single()
              : supabase.from("inventory").select("id, quantity, listing_quantity, low_stock_threshold, plant_name, variety").eq("listing_id", listing.id).maybeSingle();
            const { data: inv } = await invQuery;
            if (inv) {
              const newInvQty = Math.max(0, inv.quantity - cartItem.quantity);
              const newListingQty = Math.max(0, (inv.listing_quantity ?? 0) - cartItem.quantity);
              await supabase.from("inventory").update({ quantity: newInvQty, listing_quantity: newListingQty }).eq("id", inv.id);

              const threshold = (inv as { low_stock_threshold?: number | null }).low_stock_threshold;
              if (threshold && newInvQty <= threshold && newInvQty > 0) {
                const { data: { user: sellerUser } } = await supabase.auth.admin.getUserById(listing.seller_id);
                if (sellerUser?.email) {
                  sendLowStockAlert({
                    sellerEmail: sellerUser.email,
                    plantName: inv.plant_name,
                    variety: inv.variety ?? null,
                    quantity: newInvQty,
                    inventoryId: inv.id,
                  }).catch(() => {});
                }
              }
            }
          }
        }
      }
    }
  }

  if (event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled") {
    const pi = event.data.object;
    const { data: order } = await supabase
      .from("orders")
      .select("id, listing_id, auction_id, cart_items")
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "pending")
      .single();

    if (order) {
      // Single-listing checkout: restore stock via PI metadata (stored at checkout time)
      if (order.listing_id && pi.metadata?.listing_qty) {
        await restoreListingStock(
          supabase,
          order.listing_id,
          Number(pi.metadata.listing_qty),
          pi.metadata.inventory_id ?? null
        );
      }
      // Cart checkout: stock is only decremented on payment_intent.succeeded,
      // so nothing to restore here for failed/abandoned cart checkouts.

      // Auction orders: keep the pending order alive so the cron can mark it
      // expired after the payment deadline. The checkout route handles a canceled
      // PI by creating a new one if the winner retries.
      if (!order.auction_id) {
        await supabase.from("orders").delete().eq("id", order.id);
      }
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
