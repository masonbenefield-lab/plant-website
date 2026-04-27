import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import WishlistAuctionCard from "@/components/wishlist-auction-card";

export default async function WishlistPage() {
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

  const items = (rows ?? []).map((row) => {
    if (row.listing_id) return { type: "listing" as const, wishlistId: row.id, data: listingMap[row.listing_id] };
    if (row.auction_id) return { type: "auction" as const, wishlistId: row.id, data: auctionMap[row.auction_id] };
    return null;
  }).filter(Boolean) as { type: "listing" | "auction"; wishlistId: string; data: NonNullable<(typeof listingMap)[string]> | NonNullable<(typeof auctionMap)[string]> }[];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">My Wishlist</h1>
      <p className="text-muted-foreground text-sm mb-8">{items.length} saved item{items.length !== 1 ? "s" : ""}</p>

      {items.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌿</p>
          <p className="font-semibold mb-1">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground mb-6">Tap the heart on any listing or auction to save it here.</p>
          <div className="flex justify-center gap-3">
            <Link href="/shop" className="text-sm text-green-700 hover:underline">Browse Shop</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/auctions" className="text-sm text-green-700 hover:underline">Browse Auctions</Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {items.map(({ type, data }) => {
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
                    {data.images[0] ? (
                      <Image src={data.images[0]} alt={data.plant_name} fill className="object-cover" />
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
