import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import ShopFilterBar from "@/components/shop-filter-bar";
import WishlistButton from "@/components/wishlist-button";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; min?: string; max?: string; category?: string }>;
}) {
  const { q, sort, min, max, category } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "active");

  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);
  if (category) query = query.eq("category", category);
  if (min) query = query.gte("price_cents", Math.round(Number(min) * 100));
  if (max) query = query.lte("price_cents", Math.round(Number(max) * 100));

  if (sort === "price_asc")       query = query.order("price_cents", { ascending: true });
  else if (sort === "price_desc") query = query.order("price_cents", { ascending: false });
  else                            query = query.order("created_at", { ascending: false });

  const { data: listings } = await query;

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Shop Plants</h1>

      <Suspense>
        <ShopFilterBar />
      </Suspense>

      {!listings?.length ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg mb-2">No listings found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or search term.</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground mb-4">{listings.length} listing{listings.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {listings.map((listing) => {
              const seller = sellerMap[listing.seller_id];
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
        </>
      )}
    </div>
  );
}
