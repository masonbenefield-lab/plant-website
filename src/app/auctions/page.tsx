import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionFilterBar from "@/components/auction-filter-bar";
import WishlistButton from "@/components/wishlist-button";

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; max_bid?: string; category?: string }>;
}) {
  const { q, sort, max_bid, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("auctions")
    .select("*")
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString());

  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (max_bid) query = query.lte("current_bid_cents", Math.round(Number(max_bid) * 100));

  if (sort === "bid_asc")        query = query.order("current_bid_cents", { ascending: true });
  else if (sort === "bid_desc")  query = query.order("current_bid_cents", { ascending: false });
  else if (sort === "newest")    query = query.order("created_at", { ascending: false });
  else                           query = query.order("ends_at", { ascending: true });

  const { data: auctions } = await query;

  const sellerIds = [...new Set(auctions?.map((a) => a.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

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
          <p className="text-sm text-muted-foreground mb-4">{auctions.length} auction{auctions.length !== 1 ? "s" : ""}</p>
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
                          <p className="text-xs text-muted-foreground">Current bid</p>
                          <span className="font-bold text-green-700">
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
                    <div className="px-4 pb-3">
                      <Link
                        href={`/sellers/${seller.username}`}
                        className="text-xs text-muted-foreground hover:text-green-700 hover:underline transition-colors"
                      >
                        by {seller.username}
                      </Link>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
