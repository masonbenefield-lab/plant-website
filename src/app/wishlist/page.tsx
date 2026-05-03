import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import WishlistAuctionCard from "@/components/wishlist-auction-card";

const TAB_OPTIONS = [
  { label: "All", value: "all" },
  { label: "Listings", value: "listings" },
  { label: "Auctions", value: "auctions" },
] as const;

const SORT_OPTIONS = [
  { label: "Recently saved", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
] as const;

export default async function WishlistPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; sort?: string }>;
}) {
  const { tab = "all", sort = "newest" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: rows } = await supabase
    .from("wishlists")
    .select("id, listing_id, auction_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const listingIds = (rows ?? []).filter((r) => r.listing_id).map((r) => r.listing_id!);
  const auctionIds = (rows ?? []).filter((r) => r.auction_id).map((r) => r.auction_id!);

  const [{ data: listings }, { data: auctions }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety, price_cents, images, status, category").in("id", listingIds)
      : { data: [] },
    auctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety, current_bid_cents, images, status, ends_at, category").in("id", auctionIds)
      : { data: [] },
  ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctions ?? []).map((a) => [a.id, a]));

  type WishItem =
    | { type: "listing"; wishlistId: string; createdAt: string; data: NonNullable<(typeof listingMap)[string]> }
    | { type: "auction"; wishlistId: string; createdAt: string; data: NonNullable<(typeof auctionMap)[string]> };

  const items: WishItem[] = [];
  for (const row of rows ?? []) {
    if (row.listing_id && listingMap[row.listing_id]) {
      items.push({ type: "listing", wishlistId: row.id, createdAt: row.created_at, data: listingMap[row.listing_id] });
    } else if (row.auction_id && auctionMap[row.auction_id]) {
      items.push({ type: "auction", wishlistId: row.id, createdAt: row.created_at, data: auctionMap[row.auction_id] });
    }
  }
  let filteredItems = items;

  // Tab filter
  if (tab === "listings") filteredItems = items.filter((i) => i.type === "listing");
  else if (tab === "auctions") filteredItems = items.filter((i) => i.type === "auction");

  function getPrice(i: WishItem): number {
    if (i.type === "listing") return (i.data as { price_cents: number }).price_cents;
    return (i.data as { current_bid_cents: number }).current_bid_cents;
  }

  // Sort
  if (sort === "price_asc") filteredItems = [...filteredItems].sort((a, b) => getPrice(a) - getPrice(b));
  else if (sort === "price_desc") filteredItems = [...filteredItems].sort((a, b) => getPrice(b) - getPrice(a));
  // newest is already sorted by created_at desc from DB

  function buildHref(newTab: string, newSort: string) {
    const p = new URLSearchParams();
    if (newTab !== "all") p.set("tab", newTab);
    if (newSort !== "newest") p.set("sort", newSort);
    const qs = p.toString();
    return qs ? `/wishlist?${qs}` : "/wishlist";
  }

  const totalAll = (rows ?? []).length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">My Wishlist</h1>
      <p className="text-muted-foreground text-sm mb-5">{totalAll} saved item{totalAll !== 1 ? "s" : ""}</p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-2">
          {TAB_OPTIONS.map(({ label, value }) => (
            <Link
              key={value}
              href={buildHref(value, sort)}
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
        <div className="ml-auto flex gap-2">
          {SORT_OPTIONS.map(({ label, value }) => (
            <Link
              key={value}
              href={buildHref(tab, value)}
              className={`text-sm transition-colors ${
                sort === value
                  ? "text-green-700 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌿</p>
          <p className="font-semibold mb-1">{tab === "all" ? "Nothing saved yet" : `No ${tab} saved`}</p>
          <p className="text-sm text-muted-foreground mb-6">Tap the heart on any listing or auction to save it here.</p>
          <div className="flex justify-center gap-3">
            <Link href="/shop" className="text-sm text-green-700 hover:underline">Browse Shop</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/auctions" className="text-sm text-green-700 hover:underline">Browse Auctions</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredItems.map(({ type, data }) => {
            if (!data) return null;
            const href = type === "listing" ? `/shop/${data.id}` : `/auctions/${data.id}`;
            const isActive = data.status === "active";

            if (type === "auction") {
              const a = data as typeof auctionMap[string];
              return (
                <Link key={data.id} href={href}>
                  <WishlistAuctionCard
                    id={a.id}
                    plant_name={a.plant_name}
                    variety={a.variety ?? null}
                    category={a.category ?? null}
                    current_bid_cents={a.current_bid_cents}
                    images={a.images as string[]}
                    ends_at={a.ends_at}
                    status={a.status}
                  />
                </Link>
              );
            }

            return (
              <Link key={data.id} href={href}>
                <Card className={`hover:shadow-md transition-shadow overflow-hidden ${!isActive ? "opacity-60" : ""}`}>
                  <div className="relative h-48 bg-muted">
                    {(data.images as string[])[0] ? (
                      <Image src={(data.images as string[])[0]} alt={data.plant_name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">🌿</div>
                    )}
                    {!isActive && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <Badge variant="secondary">No longer available</Badge>
                      </div>
                    )}
                  </div>
                  <CardContent className="p-4">
                    {"category" in data && data.category && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/40">
                        {data.category}
                      </span>
                    )}
                    <p className="font-semibold truncate">{data.plant_name}</p>
                    {"variety" in data && data.variety && (
                      <p className="text-sm text-muted-foreground truncate">{data.variety}</p>
                    )}
                    <div className="mt-2">
                      <span className="font-bold text-green-700">
                        {"price_cents" in data ? centsToDisplay(data.price_cents) : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
