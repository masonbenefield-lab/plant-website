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

  const { data: listing, error: listingErr } = await admin
    .from("listings")
    .select("id, seller_id, status, quantity, inventory_id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (listingErr || !listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const newStatus = listing.status === "active" ? "paused" : "active";

  const { error: updateErr } = await admin
    .from("listings")
    .update({ status: newStatus })
    .eq("id", listingId);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // When reactivating, re-sync inventory if this listing is linked to one
  if (newStatus === "active" && listing.inventory_id) {
    const { data: inv } = await admin
      .from("inventory")
      .select("quantity, listing_quantity")
      .eq("id", listing.inventory_id)
      .single();

    if (inv) {
      await admin.from("inventory").update({
        listing_id: listingId,
        listing_quantity: listing.quantity,
      }).eq("id", listing.inventory_id);
    }
  }

  // When pausing, leave inventory link intact — just status changes
  // When going active, fire restock notifications
  const notifyRestock = newStatus === "active";

  return NextResponse.json({ ok: true, newStatus, notifyRestock });
}
