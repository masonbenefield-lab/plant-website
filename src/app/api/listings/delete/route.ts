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
    .select("id, seller_id, inventory_id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  // Block deletion if completed orders exist — those records must stay for buyer history
  const { data: completedOrders } = await admin
    .from("orders")
    .select("id")
    .eq("listing_id", listingId)
    .in("status", ["paid", "shipped", "delivered"])
    .limit(1);

  if (completedOrders?.length) {
    return NextResponse.json({
      error: "This listing has completed orders and cannot be deleted. Pause it instead to hide it from the shop.",
    }, { status: 409 });
  }

  // Delete any pending orders for this listing before deleting the listing
  await admin
    .from("orders")
    .delete()
    .eq("listing_id", listingId)
    .eq("status", "pending");

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
