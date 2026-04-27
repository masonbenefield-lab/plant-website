import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";

export default async function FeedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: follows } = await supabase
    .from("follows")
    .select("seller_id")
    .eq("follower_id", user.id);

  const sellerIds = (follows ?? []).map((f) => f.seller_id);

  const [{ data: listings }, { data: auctions }, { data: sellers }] = sellerIds.length
    ? await Promise.all([
        supabase
          .from("listings")
          .select("id, seller_id, plant_name, variety, price_cents, images, status, category, created_at")
          .eq("status", "active")
          .in("seller_id", sellerIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("auctions")
          .select("id, seller_id, plant_name, variety, current_bid_cents, images, status, ends_at, category, created_at")
          .eq("status", "active")
          .in("seller_id", sellerIds)
          .order("created_at", { ascending: false })
          .limit(40),
        supabase
          .from("profiles")
          .select("id, username, avatar_url")
          .in("id", sellerIds),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));

  type FeedItem =
    | { kind: "listing"; createdAt: string; data: NonNullable<typeof listings>[number] }
    | { kind: "auction"; createdAt: string; data: NonNullable<typeof auctions>[number] };

  const feed: FeedItem[] = [
    ...(listings ?? []).map((l) => ({ kind: "listing" as const, createdAt: l.created_at, data: l })),
    ...(auctions ?? []).map((a) => ({ kind: "auction" as const, createdAt: a.created_at, data: a })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (sellerIds.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2">Feed</h1>
        <p className="text-muted-foreground text-sm mb-8">Recent listings from sellers you follow</p>
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌱</p>
          <p className="font-semibold mb-1">You&apos;re not following anyone yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Visit a seller&apos;s storefront and click Follow to see their listings here.
          </p>
          <Link href="/shop" className="text-sm text-green-700 hover:underline">Browse the shop</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Feed</h1>
      <p className="text-muted-foreground text-sm mb-8">
        Recent listings from {sellerIds.length} seller{sellerIds.length !== 1 ? "s" : ""} you follow
      </p>

      {feed.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌿</p>
          <p className="font-semibold mb-1">Nothing new right now</p>
          <p className="text-sm text-muted-foreground">Check back later — new listings will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map(({ kind, data }) => {
            const seller = sellerMap[data.seller_id];
            const href = kind === "listing" ? `/shop/${data.id}` : `/auctions/${data.id}`;
            const images = data.images as string[];

            return (
              <div key={data.id} className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
                <Link href={`/sellers/${seller?.username}`} className="flex items-center gap-2 px-4 pt-3 pb-2 hover:bg-muted/40 transition-colors">
                  <div className="w-7 h-7 rounded-full bg-green-100 overflow-hidden border shrink-0">
                    {seller?.avatar_url ? (
                      <img src={seller.avatar_url} alt={seller.username} className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-xs font-bold text-green-700">
                        {seller?.username?.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <span className="text-sm font-medium">{seller?.username}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(data.created_at).toLocaleDateString()}
                  </span>
                </Link>

                <Link href={href} className="flex gap-4 px-4 pb-4">
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    {images[0] ? (
                      <Image src={images[0]} alt={data.plant_name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-2xl">🌿</div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-semibold truncate">{data.plant_name}</p>
                      {kind === "auction" && (
                        <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0">Auction</Badge>
                      )}
                    </div>
                    {"variety" in data && data.variety && (
                      <p className="text-sm text-muted-foreground truncate">{data.variety}</p>
                    )}
                    {"category" in data && data.category && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/40">
                        {data.category}
                      </span>
                    )}
                    <p className="text-sm font-bold text-green-700 mt-1">
                      {"price_cents" in data
                        ? centsToDisplay(data.price_cents)
                        : `Bid: ${centsToDisplay((data as { current_bid_cents: number }).current_bid_cents)}`}
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
