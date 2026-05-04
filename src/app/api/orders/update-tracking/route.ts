import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendShippingNotification } from "@/lib/email";

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

  const { orderId, trackingNumber } = await request.json() as { orderId: string; trackingNumber: string | null };

  // Fetch the order — must belong to this seller
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .select("id, buyer_id, seller_id, amount_cents, listing_id, auction_id, cart_items")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single();

  if (orderErr || !order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Save tracking number and mark shipped
  const { error: updateErr } = await supabase
    .from("orders")
    .update({ tracking_number: trackingNumber || null, status: "shipped" })
    .eq("id", orderId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Send buyer email if tracking number provided
  if (trackingNumber) {
    try {
      const admin = adminClient();
      const { data: { user: buyer } } = await admin.auth.admin.getUserById(order.buyer_id);
      if (buyer?.email) {
        let plantName = "your plant";
        const cartItems = order.cart_items as { plant_name: string }[] | null;
        if (cartItems?.length) {
          plantName = cartItems.map((i) => i.plant_name).join(", ");
        } else if (order.listing_id) {
          const { data: listing } = await supabase.from("listings").select("plant_name").eq("id", order.listing_id).single();
          if (listing) plantName = listing.plant_name;
        } else if (order.auction_id) {
          const { data: auction } = await supabase.from("auctions").select("plant_name").eq("id", order.auction_id).single();
          if (auction) plantName = auction.plant_name;
        }
        await sendShippingNotification({
          buyerEmail: buyer.email,
          plantName,
          trackingNumber,
          orderId: order.id,
        }).catch(() => {});
      }
    } catch {
      // Email failure is non-fatal
    }
  }

  return NextResponse.json({ ok: true });
}
