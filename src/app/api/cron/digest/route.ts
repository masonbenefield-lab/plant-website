import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendMonthlyDigest, type DigestListing, type DigestAuction } from "@/lib/email";

export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const twentyFiveDaysAgo = new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // 1 — opted-in users who haven't received a digest recently
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, username, email_marketing_opt_in, last_digest_sent")
    .eq("email_marketing_opt_in", true)
    .or(`last_digest_sent.is.null,last_digest_sent.lt.${twentyFiveDaysAgo}`);

  if (profileErr || !profiles?.length) {
    return NextResponse.json({ sent: 0, error: profileErr?.message ?? "No eligible users" });
  }

  const userIds = profiles.map((p) => p.id);

  // 2 — get emails from auth
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  // 3 — global: fresh listings (past 7 days, with images, joined with seller username)
  const { data: freshRaw } = await admin
    .from("listings")
    .select("id, plant_name, variety, price_cents, images, seller_id")
    .eq("status", "active")
    .gte("created_at", sevenDaysAgo)
    .not("images", "eq", "{}")
    .order("created_at", { ascending: false })
    .limit(24);

  // 4 — global: hot auctions (most bids, still active)
  const { data: auctionsRaw } = await admin
    .from("auctions")
    .select("id, plant_name, variety, current_bid_cents, ends_at, images, seller_id")
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString())
    .order("current_bid_cents", { ascending: false })
    .limit(5);

  // 5 — seller usernames for all fresh + auction sellers
  const sellerIds = [
    ...new Set([
      ...(freshRaw ?? []).map((l) => l.seller_id),
      ...(auctionsRaw ?? []).map((a) => a.seller_id),
    ]),
  ];
  const { data: sellers } = sellerIds.length
    ? await admin.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };
  const sellerMap: Record<string, string> = Object.fromEntries(
    (sellers ?? []).map((s) => [s.id, s.username])
  );

  const freshListings: DigestListing[] = (freshRaw ?? []).map((l) => ({
    id: l.id,
    plant_name: l.plant_name,
    variety: l.variety,
    price_cents: l.price_cents,
    images: l.images as string[],
    seller_username: sellerMap[l.seller_id] ?? "",
  }));

  // bid counts for hot auctions
  const auctionIds = (auctionsRaw ?? []).map((a) => a.id);
  const { data: bids } = auctionIds.length
    ? await admin.from("bids").select("auction_id").in("auction_id", auctionIds)
    : { data: [] };
  const bidCount: Record<string, number> = {};
  for (const b of bids ?? []) {
    bidCount[b.auction_id] = (bidCount[b.auction_id] ?? 0) + 1;
  }

  const hotAuctions: DigestAuction[] = (auctionsRaw ?? [])
    .sort((a, b) => (bidCount[b.id] ?? 0) - (bidCount[a.id] ?? 0))
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      plant_name: a.plant_name,
      variety: a.variety,
      current_bid_cents: a.current_bid_cents,
      ends_at: a.ends_at,
      images: a.images as string[],
      bid_count: bidCount[a.id] ?? 0,
      seller_username: sellerMap[a.seller_id] ?? "",
    }));

  // 6 — per-user follow data (one query for all users)
  const { data: allFollows } = await admin
    .from("follows")
    .select("follower_id, seller_id")
    .in("follower_id", userIds);

  const followedSellerIds = [...new Set((allFollows ?? []).map((f) => f.seller_id))];
  const { data: followedListingsRaw } = followedSellerIds.length
    ? await admin
        .from("listings")
        .select("id, plant_name, variety, price_cents, images, seller_id")
        .eq("status", "active")
        .in("seller_id", followedSellerIds)
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(100)
    : { data: [] };

  // seller usernames for followed listings
  const followedSellerUsernames = [...new Set((followedListingsRaw ?? []).map((l) => l.seller_id))];
  const { data: followedSellers } = followedSellerUsernames.length
    ? await admin.from("profiles").select("id, username").in("id", followedSellerUsernames)
    : { data: [] };
  const followedSellerMap: Record<string, string> = Object.fromEntries(
    (followedSellers ?? []).map((s) => [s.id, s.username])
  );

  // Group follows by follower
  const followerToSellers: Record<string, Set<string>> = {};
  for (const f of allFollows ?? []) {
    if (!followerToSellers[f.follower_id]) followerToSellers[f.follower_id] = new Set();
    followerToSellers[f.follower_id].add(f.seller_id);
  }

  // 7 — send emails in batches
  let sent = 0;
  const sentIds: string[] = [];

  for (const profile of profiles) {
    const email = emailMap[profile.id];
    if (!email) continue;

    // listings from followed sellers for this user
    const mySellerIds = followerToSellers[profile.id] ?? new Set();
    const followedForUser: DigestListing[] = (followedListingsRaw ?? [])
      .filter((l) => mySellerIds.has(l.seller_id))
      .slice(0, 6)
      .map((l) => ({
        id: l.id,
        plant_name: l.plant_name,
        variety: l.variety,
        price_cents: l.price_cents,
        images: l.images as string[],
        seller_username: followedSellerMap[l.seller_id] ?? "",
      }));

    // fresh picks: exclude listings from followed sellers to avoid duplication
    const freshForUser = freshListings
      .filter((l) => !mySellerIds.has(l.seller_username)) // rough dedup by username
      .slice(0, 6);

    // skip if there's nothing at all to show
    if (!followedForUser.length && !freshForUser.length && !hotAuctions.length) continue;

    try {
      await sendMonthlyDigest({
        recipientEmail: email,
        username: profile.username,
        userId: profile.id,
        month,
        followedListings: followedForUser,
        freshListings: freshForUser,
        hotAuctions,
      });
      sentIds.push(profile.id);
      sent++;
    } catch {
      // continue on individual send failure
    }
  }

  // 8 — mark digest sent
  if (sentIds.length) {
    await admin
      .from("profiles")
      .update({ last_digest_sent: new Date().toISOString() })
      .in("id", sentIds);
  }

  return NextResponse.json({ sent, total: profiles.length, month });
}
