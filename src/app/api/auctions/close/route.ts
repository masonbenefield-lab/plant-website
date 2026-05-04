import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendAuctionWon, sendAuctionEndingSoon } from "@/lib/email";

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

  // Send end reminders for auctions closing within 60 minutes that haven't been reminded yet
  const in60min = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const { data: soonAuctions } = await supabase
    .from("auctions")
    .select("id, plant_name, ends_at")
    .eq("status", "active")
    .eq("reminder_sent", false)
    .gt("ends_at", new Date().toISOString())
    .lt("ends_at", in60min);

  for (const auction of soonAuctions ?? []) {
    const { data: bids } = await supabase
      .from("bids")
      .select("bidder_id")
      .eq("auction_id", auction.id);

    const bidderIds = [...new Set((bids ?? []).map((b) => b.bidder_id))];
    const auctionUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auctions/${auction.id}`;

    await Promise.allSettled(
      bidderIds.map(async (bidderId) => {
        const { data: auth } = await supabase.auth.admin.getUserById(bidderId);
        const email = auth?.user?.email;
        if (email) await sendAuctionEndingSoon({ email, plantName: auction.plant_name, auctionUrl, endsAt: auction.ends_at });
      })
    );

    await supabase.from("auctions").update({ reminder_sent: true }).eq("id", auction.id);
  }

  // Activate scheduled auctions whose start time has passed
  const { data: scheduledAuctions } = await supabase
    .from("auctions")
    .select("id")
    .eq("status", "scheduled")
    .lt("starts_at", new Date().toISOString());
  for (const auction of scheduledAuctions ?? []) {
    await supabase.from("auctions").update({ status: "active" }).eq("id", auction.id);
  }

  const { data: expiredAuctions, error } = await supabase
    .from("auctions")
    .select("id, current_bidder_id, seller_id, current_bid_cents, plant_name, inventory_id, reserve_price_cents")
    .eq("status", "active")
    .lt("ends_at", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let closed = 0;
  for (const auction of expiredAuctions ?? []) {
    await supabase.from("auctions").update({ status: "ended" }).eq("id", auction.id);

    const reserveMet = !auction.reserve_price_cents || auction.current_bid_cents >= auction.reserve_price_cents;

    if (auction.current_bidder_id && reserveMet) {
      // Email the winner
      const { data: winnerAuth } = await supabase.auth.admin.getUserById(auction.current_bidder_id);
      const winnerEmail = winnerAuth?.user?.email;
      if (winnerEmail) {
        await sendAuctionWon({
          winnerEmail,
          plantName: auction.plant_name,
          amountCents: auction.current_bid_cents,
          checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout?auction=${auction.id}`,
        }).catch(() => {});
      }
    } else if (auction.inventory_id) {
      // No winner (no bids or reserve not met) — release inventory
      await supabase.from("inventory").update({
        auction_id: null,
        auction_quantity: null,
      }).eq("id", auction.inventory_id);
    }
    closed++;
  }

  return NextResponse.json({ closed });
}
