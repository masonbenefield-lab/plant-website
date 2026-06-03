import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendReserveOfferToBuyer } from "@/lib/email";
import { centsToDisplay } from "@/lib/stripe";

const OFFER_WINDOW_HOURS = 48;

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: auctionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();

  const { data: auction, error: auctionError } = await admin
    .from("auctions")
    .select("id, seller_id, plant_name, variety, status, current_bid_cents, current_bidder_id, reserve_price_cents, reserve_offer_status, free_shipping, shipping_cost_cents, shipping_weight_oz")
    .eq("id", auctionId)
    .single();

  if (!auction) return NextResponse.json({ error: auctionError?.message ?? "Auction not found" }, { status: 404 });
  if (auction.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (auction.status !== "ended") return NextResponse.json({ error: "Auction must be ended" }, { status: 400 });
  if (!auction.current_bidder_id) return NextResponse.json({ error: "No bids on this auction" }, { status: 400 });
  if (!auction.reserve_price_cents || auction.current_bid_cents >= auction.reserve_price_cents) {
    return NextResponse.json({ error: "Reserve was already met" }, { status: 400 });
  }
  if (auction.reserve_offer_status) {
    return NextResponse.json({ error: "An offer has already been sent" }, { status: 400 });
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + OFFER_WINDOW_HOURS * 60 * 60 * 1000);

  await admin.from("auctions").update({
    reserve_offer_sent_at: now.toISOString(),
    reserve_offer_expires_at: expiresAt.toISOString(),
    reserve_offer_status: "pending",
  }).eq("id", auctionId);

  // Build shipping label for email
  let shippingLabel = "Free";
  if (!auction.free_shipping) {
    if (auction.shipping_weight_oz) {
      // Check for pre-selected rate
      const { data: sel } = await admin
        .from("auction_shipping_selections")
        .select("cost_cents, service, carrier")
        .eq("auction_id", auctionId)
        .eq("bidder_id", auction.current_bidder_id)
        .single();
      shippingLabel = sel
        ? `${sel.carrier ?? ""} ${sel.service ?? ""} — ${centsToDisplay(sel.cost_cents)}`.trim()
        : "Calculated at checkout";
    } else if (auction.shipping_cost_cents) {
      shippingLabel = centsToDisplay(auction.shipping_cost_cents);
    }
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  const offerUrl = `${appUrl}/auctions/${auctionId}/reserve-offer`;

  const { data: buyerAuth } = await admin.auth.admin.getUserById(auction.current_bidder_id);
  const buyerEmail = buyerAuth?.user?.email;
  const displayName = auction.variety ? `${auction.plant_name} — ${auction.variety}` : auction.plant_name;
  if (buyerEmail) {
    await sendReserveOfferToBuyer({
      buyerEmail,
      plantName: displayName,
      bidCents: auction.current_bid_cents,
      shippingLabel,
      offerUrl,
      expiresAt: expiresAt.toISOString(),
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
