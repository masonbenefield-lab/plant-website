import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingIds, action, priceCents } = await req.json() as {
    listingIds: string[];
    action: "pause" | "resume" | "remove" | "price";
    priceCents?: number;
  };

  if (!listingIds?.length || !action) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify all listings belong to this seller
  const { data: listings, error: fetchError } = await supabase
    .from("listings")
    .select("id")
    .in("id", listingIds)
    .eq("seller_id", user.id);

  if (fetchError || !listings?.length) {
    return NextResponse.json({ error: "Listings not found" }, { status: 404 });
  }

  const ownedIds = listings.map((l) => l.id);

  if (action === "pause") {
    await supabase.from("listings").update({ status: "paused" }).in("id", ownedIds);
  } else if (action === "resume") {
    await supabase.from("listings").update({ status: "active" }).in("id", ownedIds);
  } else if (action === "remove") {
    await supabase.from("listings").update({ status: "paused" }).in("id", ownedIds);
    await supabase.from("inventory").update({ listing_id: null, listing_quantity: null })
      .in("listing_id", ownedIds);
  } else if (action === "price") {
    if (!priceCents || priceCents <= 0) return NextResponse.json({ error: "Invalid price" }, { status: 400 });
    await supabase.from("listings").update({ price_cents: priceCents }).in("id", ownedIds);
  }

  return NextResponse.json({ ok: true, updated: ownedIds.length });
}
