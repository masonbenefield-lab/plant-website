import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionFilterBar from "@/components/auction-filter-bar";
import WishlistButton from "@/components/wishlist-button";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 24;

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; max_bid?: string; category?: string; location?: string; has_buy_now?: string; no_bids?: string; ends_within?: string; pot_size?: string; page?: string }>;
}) {
  const { q, sort, max_bid, category, location, has_buy_now, no_bids, ends_within, pot_size, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

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
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString());

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
  if (has_buy_now === "1") query = query.not("buy_now_price_cents", "is", null);
  if (no_bids === "1") query = query.is("current_bidder_id", null);
  if (pot_size) query = query.eq("pot_size", pot_size);
  if (ends_within) {
    const ms: Record<string, number> = { "1h": 3600000, "24h": 86400000, "3d": 259200000, "7d": 604800000 };
    if (ms[ends_within]) query = query.lt("ends_at", new Date(Date.now() + ms[ends_within]).toISOString());
  }

  if (sort === "bid_asc")        query = query.order("current_bid_cents", { ascending: true });
  else if (sort === "bid_desc")  query = query.order("current_bid_cents", { ascending: false });
  else if (sort === "newest")    query = query.order("created_at", { ascending: false });
  else                           query = query.order("ends_at", { ascending: true });

  const { data: auctions, count } = await query.range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "ending_soon") params.set("sort", sort);
    if (max_bid) params.set("max_bid", max_bid);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    if (has_buy_now === "1") params.set("has_buy_now", "1");
    if (no_bids === "1") params.set("no_bids", "1");
    if (ends_within) params.set("ends_within", ends_within);
    if (pot_size) params.set("pot_size", pot_size);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/auctions?${s}` : "/auctions";
  }

  const sellerIds = [...new Set(auctions?.map((a) => a.seller_id) ?? [])];
  const [{ data: sellers }, { data: sellerRatings }] = await (sellerIds.length
    ? Promise.all([
        supabase.from("profiles").select("id, username").in("id", sellerIds),
        supabase.from("ratings").select("seller_id, score").in("seller_id", sellerIds),
      ])
    : Promise.all([{ data: [] as { id: string; username: string }[] }, { data: [] as { seller_id: string; score: number }[] }]));

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

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
      <h1 className="text-2xl font-bold mb-6">Live Auctions</h1>

      <Suspense>
        <AuctionFilterBar />
      </Suspense>

      {!auctions?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">No auctions found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or check back soon.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{total} auction{total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {auctions.map((auction) => {
              const seller = sellerMap[auction.seller_id];
              const endsAt = new Date(auction.ends_at);
              const timeLeft = endsAt.getTime() - Date.now();
              const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
              const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

              return (
                <Card key={auction.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <Link href={`/auctions/${auction.id}`} className="block">
                    <div className="relative h-48 bg-muted">
                      {auction.images[0] ? (
                        <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                      )}
                      <WishlistButton
                        userId={user?.id ?? null}
                        auctionId={auction.id}
                        initialWishlisted={wishlistedSet.has(auction.id)}
                        compact
                        className="absolute top-2 left-2 z-10"
                      />
                      <Badge className="absolute top-2 right-2 bg-red-600">
                        {hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`} left
                      </Badge>
                    </div>
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
                            {auction.bid_count > 0 ? `${auction.bid_count} bid${auction.bid_count !== 1 ? "s" : ""}` : "Starting bid"}
                          </p>
                          <span className={`font-bold ${auction.bid_count > 0 ? "text-green-700" : "text-muted-foreground"}`}>
                            {centsToDisplay(auction.current_bid_cents)}
                          </span>
                        </div>
                        {auction.buy_now_price_cents && (
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">Buy Now</p>
                            <span className="font-bold text-orange-600">
                              {centsToDisplay(auction.buy_now_price_cents)}
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Link>
                  {seller && (
                    <div className="px-4 pb-3 flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/sellers/${seller.username}`}
                        className="text-xs text-muted-foreground hover:text-green-700 hover:underline transition-colors"
                      >
                        by {seller.username}
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
    </div>
  );
}
