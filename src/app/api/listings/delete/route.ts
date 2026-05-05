import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

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

  const { listingId } = await request.json() as { listingId: string };

  const admin = adminClient();

  // Verify seller owns this listing
  const { data: listing } = await admin
    .from("listings")
    .select("id, seller_id, inventory_id, plant_name, variety, price_cents")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Block deletion if there are active orders (paid or in transit)
  const { data: activeOrders } = await admin
    .from("orders")
    .select("id")
    .eq("listing_id", listingId)
    .in("status", ["paid", "shipped"])
    .limit(1);

  if (activeOrders?.length) {
    return NextResponse.json({
      error: "This listing has an active order (paid or in transit) and cannot be deleted yet. Pause it instead to hide it from the shop.",
    }, { status: 409 });
  }

  // Enforce 30-day lock after delivery
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentDelivered } = await admin
    .from("orders")
    .select("id, delivered_at")
    .eq("listing_id", listingId)
    .eq("status", "delivered")
    .gt("delivered_at", thirtyDaysAgo)
    .limit(1);

  if (recentDelivered?.length) {
    return NextResponse.json({
      error: "This listing had a recent delivery. You can delete it 30 days after delivery, or use the auto-delete option to have it removed automatically.",
      code: "RECENT_DELIVERY",
    }, { status: 409 });
  }

  // Delete pending orders
  await admin
    .from("orders")
    .delete()
    .eq("listing_id", listingId)
    .eq("status", "pending");

  // For any remaining orders (delivered, etc.), move listing info into cart_items
  // so the order_has_source constraint is satisfied when the FK cascade nulls listing_id
  const { data: remainingOrders } = await admin
    .from("orders")
    .select("id, amount_cents")
    .eq("listing_id", listingId);

  if (remainingOrders?.length) {
    for (const order of remainingOrders) {
      const qty = listing.price_cents > 0 ? Math.round(order.amount_cents / listing.price_cents) || 1 : 1;
      await admin.from("orders").update({
        cart_items: [{
          listing_id: listingId,
          plant_name: listing.plant_name,
          variety: listing.variety ?? null,
          quantity: qty,
          price_cents: listing.price_cents,
        }],
      }).eq("id", order.id);
    }
  }

  // Clear inventory link if one exists
  if (listing.inventory_id) {
    await admin.from("inventory").update({
      listing_id: null,
      listing_quantity: 0,
    }).eq("id", listing.inventory_id);
  }

  const { error: deleteErr } = await admin
    .from("listings")
    .delete()
    .eq("id", listingId);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
