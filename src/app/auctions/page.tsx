import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Live Plant Auctions — Plantet",
  description: "Bid on rare plants in live auctions from independent growers. New auctions added regularly — find your next favorite plant.",
  openGraph: {
    title: "Live Plant Auctions — Plantet",
    description: "Bid on rare plants in live auctions from independent growers. New auctions added regularly — find your next favorite plant.",
  },
};
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionFilterBar from "@/components/auction-filter-bar";
import WishlistButton from "@/components/wishlist-button";
import { Pagination } from "@/components/pagination";
import AuctionCardGallery from "@/components/auction-card-gallery";

const PAGE_SIZE = 24;

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; max_bid?: string; category?: string; location?: string; has_buy_now?: string; no_bids?: string; ends_within?: string; pot_size?: string; page?: string; sold?: string }>;
}) {
  const { q, sort, max_bid, category, location, has_buy_now, no_bids, ends_within, pot_size, page: pageParam, sold: soldParam } = await searchParams;
  const isSoldView = soldParam === "1";
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Only show auctions from Stripe-onboarded sellers
  const { data: onboardedSellers } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_onboarded", true)
    .is("deleted_at", null);
  const onboardedSellerIds = onboardedSellers?.map((s) => s.id) ?? [];

  // Two-step location filter: find matching seller IDs first
  let locationSellerIds: string[] | null = null;
  if (location) {
    const { data: locationSellers } = await supabase
      .from("profiles")
      .select("id")
      .ilike("location", `%${location}%`)
      .is("deleted_at", null);
    locationSellerIds = locationSellers?.map((s) => s.id) ?? [];
  }

  let query = supabase
    .from("auctions")
    .select("*", { count: "exact" })
    .or("category.neq.Hidden,category.is.null")
    .in("seller_id", onboardedSellerIds.length ? onboardedSellerIds : ["00000000-0000-0000-0000-000000000000"]);

  if (isSoldView) {
    query = query.eq("status", "ended").not("current_bidder_id", "is", null);
  } else {
    query = query.eq("status", "active").gt("ends_at", new Date().toISOString());
  }

  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (locationSellerIds !== null) {
    if (locationSellerIds.length === 0) {
      query = query.in("seller_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("seller_id", locationSellerIds);
    }
  }
  if (max_bid) query = query.lte("current_bid_cents", Math.round(Number(max_bid) * 100));
  if (pot_size) query = query.eq("pot_size", pot_size);

  if (!isSoldView) {
    if (has_buy_now === "1") query = query.not("buy_now_price_cents", "is", null);
    if (no_bids === "1") query = query.is("current_bidder_id", null);
    if (ends_within) {
      const ms: Record<string, number> = { "1h": 3600000, "24h": 86400000, "3d": 259200000, "7d": 604800000 };
      if (ms[ends_within]) query = query.lt("ends_at", new Date(Date.now() + ms[ends_within]).toISOString());
    }
  }

  if (sort === "bid_asc")         query = query.order("current_bid_cents", { ascending: true });
  else if (sort === "bid_desc")   query = query.order("current_bid_cents", { ascending: false });
  else if (sort === "most_bids")  query = query.order("bid_count", { ascending: false });
  else if (sort === "newest")     query = query.order("created_at", { ascending: false });
  else if (isSoldView)            query = query.order("ends_at", { ascending: false });
  else                            query = query.order("ends_at", { ascending: true });

  const { data: auctions, count } = await query.range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildPageHref(p: number) {
    const ps = new URLSearchParams();
    if (q) ps.set("q", q);
    if (sort) ps.set("sort", sort);
    if (max_bid) ps.set("max_bid", max_bid);
    if (category) ps.set("category", category);
    if (location) ps.set("location", location);
    if (!isSoldView && has_buy_now === "1") ps.set("has_buy_now", "1");
    if (!isSoldView && no_bids === "1") ps.set("no_bids", "1");
    if (!isSoldView && ends_within) ps.set("ends_within", ends_within);
    if (pot_size) ps.set("pot_size", pot_size);
    if (isSoldView) ps.set("sold", "1");
    if (p > 1) ps.set("page", String(p));
    const s = ps.toString();
    return s ? `/auctions?${s}` : "/auctions";
  }

  const sellerIds = [...new Set(auctions?.map((a) => a.seller_id) ?? [])];
  const [{ data: sellers }, { data: sellerRatings }] = await (sellerIds.length
    ? Promise.all([
        supabase.from("profiles").select("id, username, display_name, plan").in("id", sellerIds),
        supabase.from("ratings").select("seller_id, score").in("seller_id", sellerIds),
      ])
    : Promise.all([{ data: [] as { id: string; username: string; display_name: string | null; plan: string }[] }, { data: [] as { seller_id: string; score: number }[] }]));

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

  // Priority placement: on default sort (ending_soon), Nursery > Grower > Seedling within page
  const planOrder = (plan: string | undefined) => plan === "nursery" ? 0 : plan === "grower" ? 1 : 2;
  const sortedAuctions = (!sort || sort === "ending_soon")
    ? [...(auctions ?? [])].sort((a, b) => {
        const pa = planOrder(sellerMap[a.seller_id]?.plan);
        const pb = planOrder(sellerMap[b.seller_id]?.plan);
        if (pa !== pb) return pa - pb;
        return new Date(a.ends_at).getTime() - new Date(b.ends_at).getTime();
      })
    : (auctions ?? []);

  const topSellerSet = new Set<string>();
  if (sellerRatings?.length) {
    const ratingsBySeller: Record<string, number[]> = {};
    for (const r of sellerRatings) {
      if (!ratingsBySeller[r.seller_id]) ratingsBySeller[r.seller_id] = [];
      ratingsBySeller[r.seller_id].push(r.score);
    }
    for (const [sid, scores] of Object.entries(ratingsBySeller)) {
      if (scores.length >= 10 && scores.reduce((a, b) => a + b, 0) / scores.length >= 4.5) {
        topSellerSet.add(sid);
      }
    }
  }

  // ── Recently sold auctions ──────────────────────────────────────────────
  const { data: soldAuctions } = await supabase
    .from("auctions")
    .select("id, plant_name, variety, images, current_bid_cents, ends_at, seller_id, bid_count")
    .eq("status", "ended")
    .not("current_bidder_id", "is", null)
    .or("category.neq.Hidden,category.is.null")
    .in("seller_id", onboardedSellerIds.length ? onboardedSellerIds : ["00000000-0000-0000-0000-000000000000"])
    .order("ends_at", { ascending: false })
    .limit(8);

  const soldSellerIds = [...new Set((soldAuctions ?? []).map((a) => a.seller_id))];
  const { data: soldSellers } = soldSellerIds.length
    ? await supabase.from("profiles").select("id, username, display_name").in("id", soldSellerIds)
    : { data: [] as { id: string; username: string; display_name: string | null }[] };
  const soldSellerMap = Object.fromEntries((soldSellers ?? []).map((s) => [s.id, s.display_name ?? s.username]));

  const { data: { user } } = await supabase.auth.getUser();

  const wishlistedSet = new Set<string>();
  if (user && auctions?.length) {
    const { data: wRows } = await supabase
      .from("wishlists")
      .select("auction_id")
      .eq("user_id", user.id)
      .not("auction_id", "is", null);
    (wRows ?? []).forEach((r) => { if (r.auction_id) wishlistedSet.add(r.auction_id); });
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">{isSoldView ? "Sold Auctions" : "Live Auctions"}</h1>

      <Suspense>
        <AuctionFilterBar />
      </Suspense>


      {!sortedAuctions?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">No auctions found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or check back soon.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{total} {isSoldView ? "sold auction" : "auction"}{total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedAuctions.map((auction) => {
              const seller = sellerMap[auction.seller_id];
              const endsAt = new Date(auction.ends_at);
              const timeLeft = endsAt.getTime() - Date.now();
              const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
              const hoursLeft = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
              const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
              const timeLabel = daysLeft >= 1
                ? `${daysLeft}d ${hoursLeft}h`
                : hoursLeft > 0
                  ? `${hoursLeft}h ${minutesLeft}m`
                  : `${minutesLeft}m`;

              return (
                <Card key={auction.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative">
                    <AuctionCardGallery images={auction.images as string[]} alt={auction.plant_name} />
                    {!isSoldView && (
                      <WishlistButton
                        userId={user?.id ?? null}
                        auctionId={auction.id}
                        initialWishlisted={wishlistedSet.has(auction.id)}
                        compact
                        className="absolute top-2 left-2 z-10"
                      />
                    )}
                    {isSoldView ? (
                      <Badge className="absolute top-2 right-2 z-10 bg-gray-700">
                        Sold · {timeAgo(auction.ends_at)}
                      </Badge>
                    ) : (
                      <Badge className="absolute top-2 right-2 z-10 bg-red-600">
                        {timeLabel} left
                      </Badge>
                    )}
                  </div>
                  <Link href={`/auctions/${auction.id}`} className="block">
                    <CardContent className="p-4">
                      {auction.category && (
                        <span className="inline-block text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full mb-1.5">
                          {auction.category}
                        </span>
                      )}
                      <p className="font-semibold truncate">{auction.plant_name}</p>
                      {auction.variety && (
                        <p className="text-sm text-muted-foreground truncate">{auction.variety}</p>
                      )}
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {isSoldView
                              ? `${auction.bid_count} bid${auction.bid_count !== 1 ? "s" : ""}`
                              : auction.bid_count > 0 ? `${auction.bid_count} bid${auction.bid_count !== 1 ? "s" : ""}` : "Starting bid"}
                          </p>
                          <span className="font-bold text-leaf">
                            {isSoldView ? `Sold for ${centsToDisplay(auction.current_bid_cents)}` : (
                              <span className={auction.bid_count > 0 ? "text-leaf" : "text-muted-foreground"}>
                                {centsToDisplay(auction.current_bid_cents)}
                              </span>
                            )}
                          </span>
                        </div>
                        {!isSoldView && auction.buy_now_price_cents && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Buy Now</p>
                            <span className="font-bold text-orange-600">
                              {centsToDisplay(auction.buy_now_price_cents)}
                            </span>
                          </div>
                        )}
                      </div>
                      {!isSoldView && (
                        auction.free_shipping ? (
                          <p className="text-xs text-leaf dark:text-sage font-medium mt-1.5">Free shipping</p>
                        ) : auction.shipping_cost_cents ? (
                          <p className="text-xs text-muted-foreground mt-1.5">+ {centsToDisplay(auction.shipping_cost_cents)} shipping</p>
                        ) : null
                      )}
                    </CardContent>
                  </Link>
                  {seller && (
                    <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/sellers/${seller.username}`}
                        className="text-xs text-muted-foreground hover:text-leaf hover:underline transition-colors"
                      >
                        by {seller.display_name ?? seller.username}
                      </Link>
                      {topSellerSet.has(auction.seller_id) && (
                        <span className="text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                          ⭐ Top Seller
                        </span>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            pageSize={PAGE_SIZE}
            prevHref={page > 1 ? buildPageHref(page - 1) : null}
            nextHref={page < totalPages ? buildPageHref(page + 1) : null}
          />
        </>
      )}
      {/* ── Recently sold ─────────────────────────────────────────────────── */}
      {!isSoldView && soldAuctions && soldAuctions.length > 0 && (
        <div className="mt-16">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-lg font-bold">Recently Sold</h2>
            <span className="text-xs text-muted-foreground">See what&apos;s been selling and at what price</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            {soldAuctions.map((auction) => {
              const soldAgo = timeAgo(auction.ends_at);
              const sellerUsername = soldSellerMap[auction.seller_id];
              return (
                <Link key={auction.id} href={`/auctions/${auction.id}`} className="group block">
                  <div className="relative aspect-square rounded-lg overflow-hidden bg-muted mb-2">
                    {auction.images[0] ? (
                      <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover transition-transform duration-200 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 12.5vw" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-3xl">🌿</div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                    <span className="absolute top-1.5 left-1.5 bg-gray-800/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                      Sold
                    </span>
                  </div>
                  <p className="text-sm font-medium truncate leading-tight">{auction.plant_name}</p>
                  {auction.variety && (
                    <p className="text-xs text-muted-foreground truncate">{auction.variety}</p>
                  )}
                  <p className="text-sm font-bold text-leaf mt-0.5">{centsToDisplay(auction.current_bid_cents)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {auction.bid_count} bid{auction.bid_count !== 1 ? "s" : ""} · {soldAgo}
                    {sellerUsername && <> · <span className="hover:underline">{sellerUsername}</span></>}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
