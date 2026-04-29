import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import { PLANT_CATEGORIES } from "@/lib/categories";
import ShopFilterBar from "@/components/shop-filter-bar";
import WishlistButton from "@/components/wishlist-button";
import RecentlyViewedStrip from "@/components/recently-viewed-strip";
import { Pagination } from "@/components/pagination";

const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;
const PAGE_SIZE = 24;

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; min?: string; max?: string; category?: string; in_stock?: string; location?: string; pot_size?: string; page?: string }>;
}) {
  const { q, sort, min, max, category, in_stock, location, pot_size, page: pageParam } = await searchParams;
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
    .from("listings")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%,description.ilike.%${q}%,category.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (min) query = query.gte("price_cents", Math.round(Number(min) * 100));
  if (max) query = query.lte("price_cents", Math.round(Number(max) * 100));
  if (in_stock === "1") query = query.gt("in_stock", 0);
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

  function buildPageHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (sort && sort !== "newest") params.set("sort", sort);
    if (min) params.set("min", min);
    if (max) params.set("max", max);
    if (category) params.set("category", category);
    if (in_stock === "1") params.set("in_stock", "1");
    if (location) params.set("location", location);
    if (pot_size) params.set("pot_size", pot_size);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/shop?${s}` : "/shop";
  }

  const sellerIds = [...new Set(listings?.map((l) => l.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

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

  const hasFilters = q || (sort && sort !== "newest") || min || max || category || in_stock === "1" || location;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Shop Plants</h1>

      <Suspense>
        <ShopFilterBar />
      </Suspense>

      <Suspense>
        <RecentlyViewedStrip />
      </Suspense>

      {!listings?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">No listings found</p>
          {hasFilters ? (
            <p className="text-sm text-muted-foreground mb-6">Try adjusting your filters or search term.</p>
          ) : (
            <p className="text-sm text-muted-foreground mb-6">Check back soon — new plants are added regularly.</p>
          )}
          <p className="text-sm font-medium text-muted-foreground mb-3">Browse by category</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PLANT_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/shop?category=${encodeURIComponent(c)}`}
                className="inline-flex items-center px-3 py-1.5 rounded-full border text-sm hover:bg-muted hover:border-green-600 hover:text-green-700 transition-colors"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{total} listing{total !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing) => {
              const seller = sellerMap[listing.seller_id];
              const isNew = Date.now() - new Date(listing.created_at).getTime() < NEW_THRESHOLD_MS;
              return (
                <Card key={listing.id} className="overflow-hidden hover:shadow-md transition-shadow">
                  <Link href={`/shop/${listing.id}`} className="block">
                    <div className="relative h-48 bg-muted">
                      {listing.images[0] ? (
                        <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                      )}
                      <WishlistButton
                        userId={user?.id ?? null}
                        listingId={listing.id}
                        initialWishlisted={wishlistedSet.has(listing.id)}
                        compact
                        className="absolute top-2 left-2 z-10"
                      />
                      {isNew && (
                        <span className="absolute top-2 right-2 z-10 bg-green-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
                          New
                        </span>
                      )}
                    </div>
                    <CardContent className="p-4">
                      {listing.category && (
                        <span className="inline-block text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full mb-1.5">
                          {listing.category}
                        </span>
                      )}
                      <p className="font-semibold truncate">{listing.plant_name}</p>
                      {listing.variety && (
                        <p className="text-sm text-muted-foreground truncate">{listing.variety}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-green-700">
                          {centsToDisplay(listing.price_cents)}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {listing.quantity} left
                        </Badge>
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
