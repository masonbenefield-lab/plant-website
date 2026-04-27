import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import SearchInput from "./search-input";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 20;

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  const { q = "", tab = "all", page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  const [{ data: listings, count: listingCount }, { data: auctions, count: auctionCount }] = q.trim()
    ? await Promise.all([
        supabase
          .from("listings")
          .select("id, plant_name, variety, price_cents, images, status, category", { count: "exact" })
          .eq("status", "active")
          .or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`)
          .order("created_at", { ascending: false })
          .range(from, to),
        supabase
          .from("auctions")
          .select("id, plant_name, variety, current_bid_cents, images, status, ends_at, category", { count: "exact" })
          .eq("status", "active")
          .or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`)
          .order("ends_at", { ascending: true })
          .range(from, to),
      ])
    : [{ data: [], count: 0 }, { data: [], count: 0 }];

  const listingResults = listings ?? [];
  const auctionResults = auctions ?? [];
  const listingTotal = listingCount ?? 0;
  const auctionTotal = auctionCount ?? 0;
  const total = listingTotal + auctionTotal;

  const showListings = tab === "all" || tab === "shop";
  const showAuctions = tab === "all" || tab === "auctions";

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (tab !== "all") params.set("tab", tab);
    if (p > 1) params.set("page", String(p));
    return `/search?${params.toString()}`;
  }

  const activeTotal = tab === "shop" ? listingTotal : tab === "auctions" ? auctionTotal : total;
  const totalPages = Math.ceil(activeTotal / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Search</h1>

      <SearchInput initialQ={q} />

      {q.trim() && (
        <p className="text-sm text-muted-foreground mt-4 mb-6">
          {total} result{total !== 1 ? "s" : ""} for &ldquo;{q}&rdquo;
        </p>
      )}

      {q.trim() && (
        <div className="flex gap-2 mb-8">
          {[
            { label: `All (${total})`, value: "all" },
            { label: `Shop (${listingTotal})`, value: "shop" },
            { label: `Auctions (${auctionTotal})`, value: "auctions" },
          ].map(({ label, value }) => (
            <Link
              key={value}
              href={`/search?q=${encodeURIComponent(q)}&tab=${value}`}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                tab === value
                  ? "bg-green-700 text-white border-green-700"
                  : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      )}

      {!q.trim() ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🔍</p>
          <p className="font-semibold mb-1">Search plants, varieties, and more</p>
          <p className="text-sm text-muted-foreground">Results from both the shop and live auctions.</p>
        </div>
      ) : total === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌱</p>
          <p className="font-semibold mb-1">No results found</p>
          <p className="text-sm text-muted-foreground mb-6">Try a different search term.</p>
          <div className="flex justify-center gap-3">
            <Link href="/shop" className="text-sm text-green-700 hover:underline">Browse Shop</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/auctions" className="text-sm text-green-700 hover:underline">Browse Auctions</Link>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-10">
            {showListings && listingResults.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  Shop listings
                  <span className="text-sm font-normal text-muted-foreground ml-2">{listingTotal} result{listingTotal !== 1 ? "s" : ""}</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {listingResults.map((l) => (
                    <Link key={l.id} href={`/shop/${l.id}`} className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                      <div className="relative h-36 bg-muted">
                        {(l.images as string[])?.[0] ? (
                          <Image src={(l.images as string[])[0]} alt={l.plant_name} fill className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-3xl">🌿</div>
                        )}
                      </div>
                      <div className="p-3 flex-1 flex flex-col gap-0.5">
                        <p className="font-semibold text-sm truncate">{l.plant_name}</p>
                        {l.variety && <p className="text-xs text-muted-foreground truncate">{l.variety}</p>}
                        <p className="text-sm font-bold text-green-700 mt-auto pt-2">{centsToDisplay(l.price_cents)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {showAuctions && auctionResults.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-4">
                  Live auctions
                  <span className="text-sm font-normal text-muted-foreground ml-2">{auctionTotal} result{auctionTotal !== 1 ? "s" : ""}</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {auctionResults.map((a) => (
                    <Link key={a.id} href={`/auctions/${a.id}`} className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col">
                      <div className="relative h-36 bg-muted">
                        {(a.images as string[])?.[0] ? (
                          <Image src={(a.images as string[])[0]} alt={a.plant_name} fill className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full text-3xl">🌿</div>
                        )}
                        <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">Live</span>
                      </div>
                      <div className="p-3 flex-1 flex flex-col gap-0.5">
                        <p className="font-semibold text-sm truncate">{a.plant_name}</p>
                        {a.variety && <p className="text-xs text-muted-foreground truncate">{a.variety}</p>}
                        <p className="text-sm font-bold text-green-700 mt-auto pt-2">Bid: {centsToDisplay(a.current_bid_cents)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
          <Pagination
            page={page}
            totalPages={totalPages}
            total={activeTotal}
            pageSize={PAGE_SIZE}
            prevHref={page > 1 ? buildPageHref(page - 1) : null}
            nextHref={page < totalPages ? buildPageHref(page + 1) : null}
          />
        </>
      )}
    </div>
  );
}
