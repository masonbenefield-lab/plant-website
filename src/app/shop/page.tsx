import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import ShopFilterBar from "@/components/shop-filter-bar";

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; min?: string; max?: string }>;
}) {
  const { q, sort, min, max } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("listings")
    .select("*")
    .eq("status", "active");

  // Search plant_name and variety
  if (q) query = query.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);

  // Price range
  if (min) query = query.gte("price_cents", Math.round(Number(min) * 100));
  if (max) query = query.lte("price_cents", Math.round(Number(max) * 100));

  // Sort
  if (sort === "price_asc")  query = query.order("price_cents", { ascending: true });
  else if (sort === "price_desc") query = query.order("price_cents", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data: listings } = await query;

  const sellerIds = [...new Set(listings?.map((l) => l.seller_id) ?? [])];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

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
                <Link key={listing.id} href={`/shop/${listing.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer overflow-hidden">
                    <div className="relative h-48 bg-muted">
                      {listing.images[0] ? (
                        <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                      )}
                    </div>
                    <CardContent className="p-4">
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
                      {seller && (
                        <p className="text-xs text-muted-foreground mt-1">by {seller.username}</p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
