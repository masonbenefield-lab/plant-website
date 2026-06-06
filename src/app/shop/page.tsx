import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Buy Plants Online — Plantet",
  description: "Shop rare and everyday plants from independent growers across the US. New listings added daily.",
  openGraph: {
    title: "Buy Plants Online — Plantet",
    description: "Shop rare and everyday plants from independent growers across the US. New listings added daily.",
  },
};
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import { PLANT_CATEGORIES, SUPPLY_CATEGORIES } from "@/lib/categories";
import ShopFilterBar from "@/components/shop-filter-bar";
import WishlistButton from "@/components/wishlist-button";
import AuctionCardGallery from "@/components/auction-card-gallery";
import RecentlyViewedStrip from "@/components/recently-viewed-strip";
import { Pagination } from "@/components/pagination";

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const PAGE_SIZE = 24;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; min?: string; max?: string; category?: string; on_sale?: string; location?: string; pot_size?: string; page?: string; tab?: string; stock?: string }>;
}) {
  const { q, sort, min, max, category, on_sale, location, pot_size, page: pageParam, tab: tabParam, stock } = await searchParams;
  const activeTab = tabParam === "supplies" ? "supplies" : "plants";
  const supplyOnly = SUPPLY_CATEGORIES.filter(c => c !== "Other") as string[];
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  // Only show listings from Stripe-onboarded sellers
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

  const showAll = stock !== "instock";

  let query = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .in("status", showAll ? ["active", "sold_out"] : ["active"])
    .or("category.neq.Hidden,category.is.null")
    .in("seller_id", onboardedSellerIds.length ? onboardedSellerIds : ["00000000-0000-0000-0000-000000000000"]);

  if (activeTab === "supplies") {
    // New listings: item_type = 'supply'. Old listings: supply-specific category.
    const catConditions = supplyOnly.map(c => `category.eq."${c}"`).join(",");
    query = query.or(`item_type.eq.supply,${catConditions}`);
  } else {
    // Exclude anything explicitly tagged as a supply (handles "Other" supply listings)
    query = query.or("item_type.neq.supply,item_type.is.null");
    // Also exclude supply-specific categories (handles old listings without item_type)
    for (const cat of supplyOnly) query = query.neq("category", cat);
  }

  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (min) query = query.gte("price_cents", Math.round(Number(min) * 100));
  if (max) query = query.lte("price_cents", Math.round(Number(max) * 100));

  if (on_sale === "1") query = query.not("sale_price_cents", "is", null).gt("sale_ends_at", new Date().toISOString());
  if (pot_size) query = query.eq("pot_size", pot_size);
  if (locationSellerIds !== null) {
    if (locationSellerIds.length === 0) {
      // No sellers in this location — force zero results
      query = query.in("seller_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("seller_id", locationSellerIds);
    }
  }

  if (sort === "price_asc")       query = query.order("price_cents", { ascending: true });
  else if (sort === "price_desc") query = query.order("price_cents", { ascending: false });
  else                            query = query.order("created_at", { ascending: false });

  const { data: listings, count } = await query.range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function buildTabHref(t: string) {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (sort && sort !== "newest") p.set("sort", sort);
    if (min) p.set("min", min);
    if (max) p.set("max", max);
    if (!showAll) p.set("stock", "instock");
    if (t !== "plants") p.set("tab", t);
    const s = p.toString();
    return s ? `/shop?${s}` : "/shop";
  }

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (min) params.set("min", min);
    if (max) params.set("max", max);
    if (category) params.set("category", category);
    if (on_sale === "1") params.set("on_sale", "1");
    if (location) params.set("location", location);
    if (pot_size) params.set("pot_size", pot_size);
    if (!showAll) params.set("stock", "instock");
    if (activeTab !== "plants") params.set("tab", activeTab);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/shop?${s}` : "/shop";
  }

  function buildStockHref(s: "all" | "instock" | undefined) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (min) params.set("min", min);
    if (max) params.set("max", max);
    if (category) params.set("category", category);
    if (on_sale === "1") params.set("on_sale", "1");
    if (location) params.set("location", location);
    if (pot_size) params.set("pot_size", pot_size);
    if (activeTab !== "plants") params.set("tab", activeTab);
    if (s) params.set("stock", s);
    const str = params.toString();
    return str ? `/shop?${str}` : "/shop";
  }

  const sellerIds = [...new Set(listings?.map((l) => l.seller_id) ?? [])];
  const [{ data: sellers }, { data: sellerRatings }] = await (sellerIds.length
    ? Promise.all([
        supabase.from("profiles").select("id, username, display_name, plan").in("id", sellerIds),
        supabase.from("ratings").select("seller_id, score").in("seller_id", sellerIds),
      ])
    : Promise.all([{ data: [] as { id: string; username: string; display_name: string | null; plan: string }[] }, { data: [] as { seller_id: string; score: number }[] }]));

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

  // Priority placement: on default sort (newest), Nursery > Grower > Seedling within page
  const planOrder = (plan: string | undefined) => plan === "nursery" ? 0 : plan === "grower" ? 1 : 2;
  const sortedListings = (!sort || sort === "newest")
    ? [...(listings ?? [])].sort((a, b) => {
        const pa = planOrder(sellerMap[a.seller_id]?.plan);
        const pb = planOrder(sellerMap[b.seller_id]?.plan);
        if (pa !== pb) return pa - pb;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      })
    : (listings ?? []);

  // Top seller: 10+ reviews with avg ≥ 4.5
  const topSellerSet = new Set<string>();
  const ratingMap: Record<string, { avg: number; count: number }> = {};
  if (sellerRatings?.length) {
    const ratingsByseller: Record<string, number[]> = {};
    for (const r of sellerRatings) {
      if (!ratingsByseller[r.seller_id]) ratingsByseller[r.seller_id] = [];
      ratingsByseller[r.seller_id].push(r.score);
    }
    for (const [sid, scores] of Object.entries(ratingsByseller)) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      ratingMap[sid] = { avg, count: scores.length };
      if (scores.length >= 10 && avg >= 4.5) topSellerSet.add(sid);
    }
  }

  const { data: { user } } = await supabase.auth.getUser();

  const wishlistedSet = new Set<string>();
  if (user && listings?.length) {
    const { data: wRows } = await supabase
      .from("wishlists")
      .select("listing_id")
      .eq("user_id", user.id)
      .not("listing_id", "is", null);
    (wRows ?? []).forEach((r) => { if (r.listing_id) wishlistedSet.add(r.listing_id); });
  }

  const hasFilters = q || (sort && sort !== "newest") || min || max || category || on_sale === "1" || location || showAll;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Shop</h1>

      {/* Tab bar */}
      <div className="flex border-b mb-6">
        {([
          { key: "plants", label: "Plants" },
          { key: "supplies", label: "Garden Supplies" },
        ] as const).map(({ key, label }) => (
          <Link
            key={key}
            href={buildTabHref(key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === key
                ? "border-leaf text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <Suspense>
        <ShopFilterBar activeTab={activeTab} />
      </Suspense>

      <Suspense>
        <RecentlyViewedStrip />
      </Suspense>

      {/* In Stock / All toggle */}
      <div className="flex items-center gap-2 mb-5">
        <span className="text-xs text-muted-foreground font-medium">Show:</span>
        <div className="flex rounded-lg border overflow-hidden text-xs font-medium">
          <Link
            href={buildStockHref("instock")}
            className={`px-3 py-1.5 transition-colors ${!showAll ? "bg-leaf text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            In Stock
          </Link>
          <Link
            href={buildStockHref(undefined)}
            className={`px-3 py-1.5 border-l transition-colors ${showAll ? "bg-leaf text-white" : "text-muted-foreground hover:bg-muted"}`}
          >
            All
          </Link>
        </div>
      </div>

      {!sortedListings?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">No listings found</p>
          {hasFilters ? (
            <p className="text-sm text-muted-foreground mb-6">Try adjusting your filters or search term.</p>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">
              {activeTab === "supplies"
                ? "Check back soon — new garden supplies are added regularly."
                : "Check back soon — new plants are added regularly."}
            </p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{total} listing{total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {sortedListings.map((listing) => {
              const seller = sellerMap[listing.seller_id];
              const isNew = Date.now() - new Date(listing.created_at).getTime() < NEW_THRESHOLD_MS;
              const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
              const displayPrice = onSale ? listing.sale_price_cents! : listing.price_cents;
              return (
                <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <div className="relative">
                    <Link href={`/shop/${listing.id}`} className="block">
                      <AuctionCardGallery images={listing.images as string[]} alt={listing.plant_name} objectFit="cover" />
                    </Link>
                    <WishlistButton
                      userId={user?.id ?? null}
                      listingId={listing.id}
                      initialWishlisted={wishlistedSet.has(listing.id)}
                      compact
                      className="absolute top-2 left-2 z-10"
                    />
                    {onSale && (
                      <span className="absolute top-2 right-2 z-10 bg-red-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        SALE
                      </span>
                    )}
                    {!onSale && isNew && (
                      <span className="absolute top-2 right-2 z-10 bg-leaf text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                        New
                        </span>
                      )}
                    </div>
                  <Link href={`/shop/${listing.id}`} className="block">
                    <CardContent className="p-4">
                      {listing.category && (
                        <span className="inline-block text-xs font-medium text-leaf dark:text-sage bg-[#DFE7D4] dark:bg-forest/40 px-2 py-0.5 rounded-full mb-1.5">
                          {listing.category}
                        </span>
                      )}
                      <p className="font-semibold truncate">{listing.plant_name}</p>
                      {listing.variety && (
                        <p className="text-sm text-muted-foreground truncate">{listing.variety}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${onSale ? "text-red-600" : "text-leaf"}`}>
                            {centsToDisplay(displayPrice)}
                          </span>
                          {onSale && (
                            <span className="text-xs text-muted-foreground line-through">
                              {centsToDisplay(listing.price_cents)}
                            </span>
                          )}
                        </div>
                        {listing.status === "sold_out" ? (
                          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                            Out of stock
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            {listing.quantity} left
                          </Badge>
                        )}
                      </div>
                      {listing.free_shipping ? (
                        <p className="text-xs text-leaf dark:text-sage font-medium mt-1.5">Free shipping</p>
                      ) : listing.shipping_cost_cents ? (
                        <p className="text-xs text-muted-foreground mt-1.5">+ {centsToDisplay(listing.shipping_cost_cents)} shipping</p>
                      ) : null}
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
                      {ratingMap[listing.seller_id]?.count >= 3 && (
                        <span className="text-xs text-amber-500 font-medium">
                          ★ {ratingMap[listing.seller_id].avg.toFixed(1)}
                          <span className="text-muted-foreground font-normal ml-0.5">({ratingMap[listing.seller_id].count})</span>
                        </span>
                      )}
                      {topSellerSet.has(listing.seller_id) && (
                        <span
                          title="This seller has 10+ reviews with a 4.5★ or higher average"
                          className="text-xs font-semibold text-amber-700 bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 px-1.5 py-0.5 rounded-full cursor-help"
                        >
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
