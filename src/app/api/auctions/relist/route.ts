import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auctionId } = await request.json();
  if (!auctionId) return NextResponse.json({ error: "Missing auctionId" }, { status: 400 });

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: original, error: fetchError } = await admin
    .from("auctions")
    .select("*")
    .eq("id", auctionId)
    .eq("seller_id", user.id)
    .single();

  if (fetchError || !original) {
    return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  }

  if (original.status !== "ended" && original.status !== "expired" && original.status !== "cancelled") {
    return NextResponse.json({ error: "Only ended auctions can be relisted" }, { status: 400 });
  }

  const endsAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: newAuction, error: insertError } = await admin
    .from("auctions")
    .insert({
      seller_id: user.id,
      plant_name: original.plant_name,
      variety: original.variety,
      quantity: original.quantity,
      description: original.description,
      images: original.images,
      starting_bid_cents: original.starting_bid_cents,
      current_bid_cents: original.starting_bid_cents,
      buy_now_price_cents: original.buy_now_price_cents,
      reserve_price_cents: original.reserve_price_cents,
      category: original.category,
      pot_size: original.pot_size,
      free_shipping: original.free_shipping,
      shipping_cost_cents: original.shipping_cost_cents,
      shipping_weight_oz: original.shipping_weight_oz,
      ends_at: endsAt,
      status: "active",
    })
    .select("id")
    .single();

  if (insertError || !newAuction) {
    return NextResponse.json({ error: "Failed to relist auction" }, { status: 500 });
  }

  return NextResponse.json({ id: newAuction.id });
}
