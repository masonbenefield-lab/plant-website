import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database, OrderStatus } from "@/lib/supabase/types";
import { sendOrderDelivered } from "@/lib/email";

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

  const { orderId, status } = await request.json() as { orderId: string; status: OrderStatus };

  const admin = adminClient();

  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id, buyer_id, status, tracking_number, listing_id, auction_id, cart_items")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Sellers may only advance status forward through the fulfillment flow
  const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };
  const currentRank = STATUS_RANK[order.status] ?? -1;
  const newRank = STATUS_RANK[status] ?? -1;
  if (newRank <= currentRank) {
    return NextResponse.json({ error: "Cannot move an order backward in status" }, { status: 400 });
  }

  if ((status === "shipped" || status === "delivered") && !order.tracking_number) {
    return NextResponse.json({ error: "Please add a tracking number before marking this order as shipped" }, { status: 400 });
  }

  const update: Database["public"]["Tables"]["orders"]["Update"] = { status };
  if (status === "delivered") {
    update.delivered_at = new Date().toISOString();
  }

  const { error } = await admin.from("orders").update(update).eq("id", orderId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify buyer when seller marks order delivered
  if (status === "delivered") {
    const { data: { user: buyer } } = await admin.auth.admin.getUserById(order.buyer_id);
    if (buyer?.email) {
      let emailItems: { name: string; quantity: number }[] = [];
      const cartItems = order.cart_items as { plant_name: string; variety: string | null; quantity: number }[] | null;
      if (cartItems?.length) {
        emailItems = cartItems.map((ci) => ({
          name: ci.variety ? `${ci.plant_name} — ${ci.variety}` : ci.plant_name,
          quantity: ci.quantity,
        }));
      } else if (order.listing_id) {
        const { data: listing } = await admin.from("listings").select("plant_name, variety").eq("id", order.listing_id).single();
        if (listing) emailItems = [{ name: listing.variety ? `${listing.plant_name} — ${listing.variety}` : listing.plant_name, quantity: 1 }];
      } else if (order.auction_id) {
        const { data: auction } = await admin.from("auctions").select("plant_name, variety").eq("id", order.auction_id).single();
        if (auction) emailItems = [{ name: auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name, quantity: 1 }];
      }
      if (emailItems.length) {
        sendOrderDelivered({ buyerEmail: buyer.email, items: emailItems, orderId: order.id }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
