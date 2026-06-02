import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendSecondBidderOffer } from "@/lib/email";

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

  const { orderId } = await request.json() as { orderId: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const admin = adminClient();

  // Fetch the expired order — must belong to this seller
  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id, buyer_id, auction_id, amount_cents, status")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "expired") return NextResponse.json({ error: "Order is not expired" }, { status: 400 });
  if (!order.auction_id) return NextResponse.json({ error: "Not an auction order" }, { status: 400 });

  // Confirm no second-bidder offer already in flight (another pending order for this auction)
  const { data: existingOffer } = await admin
    .from("orders")
    .select("id")
    .eq("auction_id", order.auction_id)
    .eq("status", "pending")
    .neq("id", orderId)
    .maybeSingle();

  if (existingOffer) {
    return NextResponse.json({ error: "A second-bidder offer is already in progress" }, { status: 409 });
  }

  // Find the second highest bidder (highest bid not from the original winner)
  const { data: secondBid } = await admin
    .from("bids")
    .select("bidder_id, amount_cents")
    .eq("auction_id", order.auction_id)
    .neq("bidder_id", order.buyer_id)
    .order("amount_cents", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!secondBid) {
    return NextResponse.json({ error: "No other bidders to offer to" }, { status: 400 });
  }

  const { data: auction } = await admin
    .from("auctions")
    .select("plant_name, variety, seller_id")
    .eq("id", order.auction_id)
    .single();

  if (!auction) return NextResponse.json({ error: "Auction not found" }, { status: 404 });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop";
  const deadline = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Create a new pending order for the second bidder at their bid price
  const { data: newOrder, error: orderErr } = await admin
    .from("orders")
    .insert({
      buyer_id: secondBid.bidder_id,
      seller_id: user.id,
      auction_id: order.auction_id,
      amount_cents: secondBid.amount_cents,
      shipping_address: { name: "", line1: "", city: "", state: "", zip: "", country: "US" }, // placeholder — filled at checkout
      payment_deadline_at: deadline.toISOString(),
    })
    .select("id")
    .single();

  if (orderErr || !newOrder) {
    return NextResponse.json({ error: orderErr?.message ?? "Failed to create offer" }, { status: 500 });
  }

  // Mark the original expired order as offered_down
  await admin.from("orders").update({ status: "offered_down" }).eq("id", orderId);

  // Email the second bidder
  const { data: bidderAuth } = await admin.auth.admin.getUserById(secondBid.bidder_id);
  const bidderEmail = bidderAuth?.user?.email;
  if (bidderEmail) {
    const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
    await sendSecondBidderOffer({
      bidderEmail,
      plantName: displayName,
      bidCents: secondBid.amount_cents,
      checkoutUrl: `${appUrl}/checkout?auction=${order.auction_id}&offer=${newOrder.id}`,
      expiresAt: deadline.toISOString(),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, offerId: newOrder.id, bidderFound: true });
}
