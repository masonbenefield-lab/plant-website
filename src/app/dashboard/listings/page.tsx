export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { centsToDisplay } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import DashboardSearch from "@/components/dashboard-search";
import PauseAllButton from "./pause-all-button";
import ListingActions from "./listing-actions";

export const metadata: Metadata = { title: "My Shop — Plantet Dashboard" };

const PAGE_SIZE = 25;

export default async function DashboardListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, stripe_onboarded")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/listings");
  }

  const stripeOnboarded = !!profile?.stripe_onboarded;

  let listingsQuery = supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  if (q) listingsQuery = listingsQuery.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);

  const { data: listings, count } = await listingsQuery.range(from, to);

  // Fetch inventory stock data for linked listings
  const inventoryIds = (listings ?? []).filter(l => l.inventory_id).map(l => l.inventory_id!);
  const { data: invRows } = inventoryIds.length
    ? await supabase.from("inventory").select("id, quantity, listing_quantity").in("id", inventoryIds)
    : { data: [] };
  const invMap = Object.fromEntries((invRows ?? []).map(r => [r.id, r]));

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const activeCount = (listings ?? []).filter(l => l.status === "active").length;
  const pausedCount = (listings ?? []).filter(l => l.status === "paused").length;
  const soldOutCount = (listings ?? []).filter(l => l.status === "sold_out").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div>
          <h1 className="text-2xl font-bold">My Shop</h1>
          {total > 0 && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {activeCount} active{pausedCount > 0 ? ` · ${pausedCount} paused` : ""}{soldOutCount > 0 ? ` · ${soldOutCount} sold out` : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <PauseAllButton sellerId={user.id} />
          <Link
            href="/dashboard/inventory"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors whitespace-nowrap"
          >
            + Add from My Stock
          </Link>
        </div>
      </div>

      <div className="mb-6 mt-4">
        <DashboardSearch placeholder="Search listings…" basePath="/dashboard/listings" />
      </div>

      {!stripeOnboarded && !!listings?.length && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Your listings are not visible to buyers yet.</strong> Connect your Stripe account to make them purchasable.{" "}
          <a href="/account#seller-payments" className="underline font-medium hover:opacity-80">Set up payments →</a>
        </div>
      )}

      {!listings?.length ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed">
          <div className="text-4xl mb-3">🌿</div>
          <h2 className="text-lg font-semibold mb-1">No listings yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-5">
            Listings are created from My Stock. Open any stock item and click <strong>List in Shop</strong> to set a price and make it visible to buyers.
          </p>
          <Link
            href="/dashboard/inventory"
            className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors"
          >
            Go to My Stock →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {listings.map((listing) => {
            const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
            const displayPrice = onSale ? listing.sale_price_cents! : listing.price_cents;
            const inv = listing.inventory_id ? invMap[listing.inventory_id] : null;
            const totalStock = inv?.quantity ?? listing.quantity;
            const inShop = inv?.listing_quantity ?? listing.quantity;

            return (
              <Card key={listing.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex items-stretch gap-0">
                    {/* Color bar by status */}
                    <div className={`w-1 shrink-0 ${
                      listing.status === "active" ? "bg-leaf" :
                      listing.status === "paused" ? "bg-yellow-400" :
                      "bg-red-400"
                    }`} />

                    {/* Thumbnail */}
                    <div className="w-16 h-16 sm:w-20 sm:h-20 shrink-0 bg-muted self-center mx-3 my-3 rounded-md overflow-hidden border">
                      {listing.images?.[0] ? (
                        <Image
                          src={listing.images[0]}
                          alt={listing.plant_name}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                      )}
                    </div>

                    {/* Main info */}
                    <div className="flex-1 min-w-0 py-3 pr-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold truncate">{listing.plant_name}</span>
                            {listing.variety && (
                              <span className="text-sm text-muted-foreground">· {listing.variety}</span>
                            )}
                            {listing.pot_size && (
                              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">{listing.pot_size}</span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            {/* Price */}
                            <div className="flex items-center gap-1.5">
                              <span className={`text-sm font-semibold ${onSale ? "text-red-600" : "text-leaf"}`}>
                                {centsToDisplay(displayPrice)}
                              </span>
                              {onSale && (
                                <span className="text-xs text-muted-foreground line-through">{centsToDisplay(listing.price_cents)}</span>
                              )}
                            </div>

                            {/* Status badge */}
                            <Badge
                              variant={listing.status === "active" ? "default" : "secondary"}
                              className={
                                listing.status === "active" ? "bg-leaf text-white text-[11px] px-1.5 py-0" :
                                listing.status === "paused" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 text-[11px] px-1.5 py-0" :
                                "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 text-[11px] px-1.5 py-0"
                              }
                            >
                              {listing.status === "sold_out" ? "Sold Out" : listing.status}
                            </Badge>

                            {onSale && (
                              <Badge className="bg-red-600 text-white text-[11px] px-1.5 py-0">SALE</Badge>
                            )}

                            {(listing as { bundle_discount_pct?: number | null }).bundle_discount_pct && (
                              <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 text-[11px] px-1.5 py-0">
                                {(listing as { bundle_discount_pct: number }).bundle_discount_pct}% off 2+
                              </Badge>
                            )}
                          </div>

                          {/* Stock info */}
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                            <span>{inShop} listed</span>
                            {inv && totalStock !== inShop && (
                              <span>{totalStock} total in stock</span>
                            )}
                            {listing.category && (
                              <span className="text-blue-600 dark:text-blue-400">{listing.category}</span>
                            )}
                            {listing.inventory_id ? (
                              <Link href={`/dashboard/inventory?q=${encodeURIComponent(listing.plant_name)}`} className="hover:underline hover:text-foreground">
                                View in inventory →
                              </Link>
                            ) : null}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="shrink-0">
                          <ListingActions listing={listing} />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        prevHref={page > 1 ? `/dashboard/listings?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
        nextHref={page < totalPages ? `/dashboard/listings?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
      />
    </div>
  );
}
