import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionFilterBar from "@/components/auction-filter-bar";

export default async function AuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; max_bid?: string }>;
}) {
  const { q, sort, max_bid } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("auctions")
    .select("*")
    .eq("status", "active")
    .gt("ends_at", new Date().toISOString());

  // Search plant_name and variety
  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);

  // Max bid filter
  if (max_bid) query = query.lte("current_bid_cents", Math.round(Number(max_bid) * 100));

  // Sort
  if (sort === "bid_asc")   query = query.order("current_bid_cents", { ascending: true });
  else if (sort === "bid_desc")  query = query.order("current_bid_cents", { ascending: false });
  else if (sort === "newest")    query = query.order("created_at", { ascending: false });
  else query = query.order("ends_at", { ascending: true }); // default: ending soon

  const { data: auctions } = await query;

  const sellerIds = [...new Set(auctions?.map((a) => a.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

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
                <Card key={auction.id} className="relative hover:shadow-md transition-shadow overflow-hidden">
                  {/* Stretched link covers the whole card */}
                  <Link href={`/auctions/${auction.id}`} className="absolute inset-0 z-0" aria-label={auction.plant_name} />
                  <div className="relative h-48 bg-muted">
                    {auction.images[0] ? (
                      <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                    )}
                    <Badge className="absolute top-2 right-2 bg-red-600">
                      {hoursLeft > 0 ? `${hoursLeft}h ${minutesLeft}m` : `${minutesLeft}m`} left
                    </Badge>
                  </div>
                  <CardContent className="relative p-4">
                    <p className="font-semibold truncate">{auction.plant_name}</p>
                    {auction.variety && (
                      <p className="text-sm text-muted-foreground truncate">{auction.variety}</p>
                    )}
                    <div className="mt-2">
                      <p className="text-xs text-muted-foreground">Current bid</p>
                      <span className="font-bold text-green-700">
                        {centsToDisplay(auction.current_bid_cents)}
                      </span>
                    </div>
                    {seller && (
                      <Link
                        href={`/sellers/${seller.username}`}
                        className="relative z-10 text-xs text-muted-foreground hover:text-green-700 hover:underline transition-colors mt-1 inline-block"
                      >
                        by {seller.username}
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
