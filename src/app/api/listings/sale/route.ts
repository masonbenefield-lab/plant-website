import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { dollarsToCents } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { listingId, salePrice, saleEndsAt, clear } = await request.json() as {
    listingId: string;
    salePrice?: string;
    saleEndsAt?: string;
    clear?: boolean;
  };

  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const { data: listing } = await supabase
    .from("listings")
    .select("id, seller_id, price_cents")
    .eq("id", listingId)
    .eq("seller_id", user.id)
    .single();

  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });

  if (clear) {
    await supabase.from("listings").update({ sale_price_cents: null, sale_ends_at: null }).eq("id", listingId);
    return NextResponse.json({ success: true });
  }

  if (!salePrice || !saleEndsAt) {
    return NextResponse.json({ error: "salePrice and saleEndsAt required" }, { status: 400 });
  }

  const saleCents = dollarsToCents(salePrice);
  if (isNaN(saleCents) || saleCents <= 0) {
    return NextResponse.json({ error: "Invalid sale price" }, { status: 400 });
  }
  if (saleCents >= listing.price_cents) {
    return NextResponse.json({ error: "Sale price must be less than the regular price" }, { status: 400 });
  }

  const endsAt = new Date(saleEndsAt);
  if (isNaN(endsAt.getTime()) || endsAt <= new Date()) {
    return NextResponse.json({ error: "End date must be in the future" }, { status: 400 });
  }

  const { error } = await supabase
    .from("listings")
    .update({ sale_price_cents: saleCents, sale_ends_at: saleEndsAt })
    .eq("id", listingId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
