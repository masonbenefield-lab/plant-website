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

  const supabase = adminClient();

  const { data: expiredAuctions, error } = await supabase
    .from("auctions")
    .select("id, current_bidder_id, seller_id, current_bid_cents, plant_name, inventory_id")
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let closed = 0;
  for (const auction of expiredAuctions ?? []) {
    await supabase.from("auctions").update({ status: "ended" }).eq("id", auction.id);
    if (!auction.current_bidder_id && auction.inventory_id) {
      await supabase.from("inventory").update({
        auction_id: null,
        auction_quantity: null,
      }).eq("id", auction.inventory_id);
    }
    closed++;
  }

  return NextResponse.json({ closed });
}
