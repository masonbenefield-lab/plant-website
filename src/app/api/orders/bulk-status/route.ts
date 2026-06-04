import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrderStatus } from "@/lib/order-types";
import { sendShippingNotification } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const VALID_STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];
const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", user.id).single();
  const plan = profile?.plan ?? "seedling";
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;

  if (!isAdmin && plan === "seedling") {
    return NextResponse.json({ error: "Bulk order updates require a Grower or Nursery plan." }, { status: 403 });
  }

  const batchLimit = isAdmin || plan === "nursery" ? 200 : 50;

  const { orderIds, status, trackingNumbers = {} } = await request.json() as {
    orderIds: string[];
    status: OrderStatus;
    trackingNumbers?: Record<string, string>;
  };

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }
  if (orderIds.length > batchLimit) {
    return NextResponse.json({ error: `Too many orders — your plan allows up to ${batchLimit} at once.` }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  // Fetch current orders to enforce forward-only transitions
  const { data: currentOrders } = await supabase
    .from("orders")
    .select("id, status, buyer_id, listing_id, auction_id, cart_items")
    .in("id", orderIds)
    .eq("seller_id", user.id);

  if (!currentOrders?.length) {
    return NextResponse.json({ error: "No matching orders found" }, { status: 404 });
  }

  // Only update orders where the target status is a forward move
  const eligibleIds = currentOrders
    .filter((o) => STATUS_RANK[status] > STATUS_RANK[o.status])
    .map((o) => o.id);

  if (eligibleIds.length === 0) {
    return NextResponse.json({ error: "Selected orders are already at or past that status" }, { status: 400 });
  }

  const updatePayload: { status: OrderStatus; delivered_at?: string } = { status };
  if (status === "delivered") updatePayload.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from("orders")
    .update(updatePayload)
    .in("id", eligibleIds)
    .eq("seller_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Handle tracking numbers for shipped orders
  if (status === "shipped" && Object.keys(trackingNumbers).length > 0) {
    const admin = adminClient();
    for (const orderId of eligibleIds) {
      const tracking = trackingNumbers[orderId]?.trim();
      if (!tracking) continue;

      await supabase
        .from("orders")
        .update({ tracking_number: tracking })
        .eq("id", orderId);

      // Send shipping notification email
      try {
        const order = currentOrders.find((o) => o.id === orderId);
        if (!order) continue;
        const { data: { user: buyer } } = await admin.auth.admin.getUserById(order.buyer_id);
        if (!buyer?.email) continue;

        let plantName = "your plant";
        const cartItems = order.cart_items as { plant_name: string; variety?: string | null }[] | null;
        if (cartItems?.length) {
          plantName = cartItems.map((i) => i.variety ? `${i.plant_name} — ${i.variety}` : i.plant_name).join(", ");
        } else if (order.listing_id) {
          const { data: listing } = await supabase.from("listings").select("plant_name, variety").eq("id", order.listing_id).single();
          if (listing) plantName = listing.variety ? `${listing.plant_name} — ${listing.variety}` : listing.plant_name;
        } else if (order.auction_id) {
          const { data: auction } = await supabase.from("auctions").select("plant_name, variety").eq("id", order.auction_id).single();
          if (auction) plantName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
        }

        await sendShippingNotification({
          buyerEmail: buyer.email,
          plantName,
          trackingNumber: tracking,
          orderId,
        }).catch(() => {});
      } catch {
        // Email failure is non-fatal
      }
    }
  }

  return NextResponse.json({ success: true, count: eligibleIds.length });
}
