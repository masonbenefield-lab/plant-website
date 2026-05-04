import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOrderConfirmation } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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
      .select("id, buyer_id, amount_cents, listing_id, auction_id")
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

      const { data: { user: buyer } } = await supabase.auth.admin.getUserById(order.buyer_id);
      if (buyer?.email) {
        let plantName = "your plant";
        if (order.listing_id) {
          const { data: listing } = await supabase.from("listings").select("plant_name").eq("id", order.listing_id).single();
          if (listing) plantName = listing.plant_name;
        } else if (order.auction_id) {
          const { data: auction } = await supabase.from("auctions").select("plant_name").eq("id", order.auction_id).single();
          if (auction) plantName = auction.plant_name;
        }
        await sendOrderConfirmation({ buyerEmail: buyer.email, plantName, amountCents: order.amount_cents, orderId: order.id }).catch(() => {});
      }
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await supabase
      .from("orders")
      .delete()
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "pending");
  }

  return NextResponse.json({ received: true });
}
