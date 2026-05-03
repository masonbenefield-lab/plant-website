import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendRestockNotification } from "@/lib/email";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId } = await request.json() as { listingId: string };
  if (!listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });

  // Verify caller owns the listing
  const { data: listing } = await supabase
    .from("listings")
    .select("id, plant_name, seller_id")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  const admin = adminClient();
  const { data: subscribers } = await admin
    .from("restock_notifications")
    .select("id, email")
    .eq("listing_id", listingId);

  if (!subscribers?.length) return NextResponse.json({ success: true, notified: 0 });

  const listingUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/shop/${listingId}`;

  await Promise.allSettled(
    subscribers.map((sub) =>
      sendRestockNotification({ email: sub.email, plantName: listing.plant_name, listingUrl })
    )
  );

  await admin.from("restock_notifications").delete().eq("listing_id", listingId);

  return NextResponse.json({ success: true, notified: subscribers.length });
}
