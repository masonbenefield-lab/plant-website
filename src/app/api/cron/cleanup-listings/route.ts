import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const now = new Date().toISOString();

  // Fetch listings past their scheduled delete date
  const { data: listings, error: fetchErr } = await admin
    .from("listings")
    .select("id, inventory_id")
    .lte("scheduled_delete_at", now);

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!listings?.length) return NextResponse.json({ ok: true, deleted: 0 });

  let deleted = 0;
  for (const listing of listings) {
    // Clear inventory link
    if (listing.inventory_id) {
      await admin.from("inventory").update({
        listing_id: null,
        listing_quantity: 0,
      }).eq("id", listing.inventory_id);
    }

    // Delete pending orders
    await admin.from("orders").delete()
      .eq("listing_id", listing.id)
      .eq("status", "pending");

    const { error } = await admin.from("listings").delete().eq("id", listing.id);
    if (!error) deleted++;
  }

  // Auto-deliver orders that have been in "shipped" status for 14+ days
  const cutoff = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: staleShipped } = await admin
    .from("orders")
    .select("id")
    .eq("status", "shipped")
    .lt("updated_at", cutoff);

  let autoDelivered = 0;
  for (const order of staleShipped ?? []) {
    const { error } = await admin
      .from("orders")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", order.id);
    if (!error) autoDelivered++;
  }

  return NextResponse.json({ ok: true, deleted, autoDelivered });
}
