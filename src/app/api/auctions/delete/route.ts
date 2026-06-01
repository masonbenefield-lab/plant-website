import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auctionId } = await request.json() as { auctionId: string };
  const admin = adminClient();

  const { data: auction } = await admin
    .from("auctions")
    .select("id, seller_id, status")
    .eq("id", auctionId)
    .single();

  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.seller_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const deletableStatuses = ["ended", "cancelled", "expired"];
  if (!deletableStatuses.includes(auction.status)) {
    return NextResponse.json({ error: "Only ended, cancelled, or expired auctions can be deleted" }, { status: 400 });
  }

  // Block deletion if a paid order exists for this auction
  const { data: paidOrder } = await admin
    .from("orders")
    .select("id")
    .eq("auction_id", auctionId)
    .eq("status", "paid")
    .maybeSingle();

  if (paidOrder) {
    return NextResponse.json({ error: "This auction has a completed order and cannot be deleted" }, { status: 409 });
  }

  const { error } = await admin.from("auctions").delete().eq("id", auctionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
