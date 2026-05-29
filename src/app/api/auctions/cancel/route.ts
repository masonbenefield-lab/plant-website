import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendAuctionCancelled } from "@/lib/email";
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
    .select("id, seller_id, plant_name, variety, status, inventory_id")
    .eq("id", auctionId)
    .single();

  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });
  if (auction.seller_id !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  if (auction.status !== "active" && auction.status !== "scheduled") {
    return NextResponse.json({ error: "Auction cannot be cancelled" }, { status: 400 });
  }

  // Scheduled auctions have no bids — just delete and release inventory
  if (auction.status === "scheduled") {
    const { error } = await admin.from("auctions").delete().eq("id", auctionId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (auction.inventory_id) {
      await admin
        .from("inventory")
        .update({ auction_id: null, auction_quantity: null })
        .eq("id", auction.inventory_id);
    }

    return NextResponse.json({ ok: true, notified: 0 });
  }

  // Get all unique bidders
  const { data: bids } = await admin
    .from("bids")
    .select("bidder_id")
    .eq("auction_id", auctionId);

  const bidderIds = [...new Set((bids ?? []).map((b) => b.bidder_id))];

  // Cancel the auction
  const { error } = await admin
    .from("auctions")
    .update({ status: "cancelled" })
    .eq("id", auctionId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Release inventory if linked
  if (auction.inventory_id) {
    await admin
      .from("inventory")
      .update({ auction_id: null, auction_quantity: null })
      .eq("id", auction.inventory_id);
  }

  // Notify bidders (fire-and-forget, don't block response)
  if (bidderIds.length > 0) {
    const plantName = auction.variety
      ? `${auction.plant_name} ${auction.variety}`
      : auction.plant_name;

    const emailResults = await Promise.all(
      bidderIds.map((uid) => admin.auth.admin.getUserById(uid))
    );

    await Promise.allSettled(
      emailResults
        .filter(({ data }) => data?.user?.email)
        .map(({ data }) =>
          sendAuctionCancelled({
            bidderEmail: data!.user!.email!,
            plantName,
            auctionId,
          })
        )
    );
  }

  return NextResponse.json({ ok: true, notified: bidderIds.length });
}
