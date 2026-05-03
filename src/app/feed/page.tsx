import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import FeedUpdates from "@/components/feed-updates";
import FeedList from "./feed-list";

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

  type FeedItem = {
    id: string;
    kind: "listing" | "auction";
    createdAt: string;
    seller_id: string;
    plant_name: string;
    variety: string | null;
    category: string | null;
    images: string[];
    price_cents?: number;
    current_bid_cents?: number;
  };

  const feed: FeedItem[] = [
    ...(listings ?? []).map((l) => ({
      id: l.id, kind: "listing" as const, createdAt: l.created_at, seller_id: l.seller_id,
      plant_name: l.plant_name, variety: l.variety ?? null, category: l.category ?? null,
      images: (l.images ?? []) as string[], price_cents: l.price_cents,
    })),
    ...(auctions ?? []).map((a) => ({
      id: a.id, kind: "auction" as const, createdAt: a.created_at, seller_id: a.seller_id,
      plant_name: a.plant_name, variety: a.variety ?? null, category: a.category ?? null,
      images: (a.images ?? []) as string[], current_bid_cents: a.current_bid_cents,
    })),
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
      <FeedUpdates sellerIds={sellerIds} />
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
        <FeedList items={feed} sellerMap={sellerMap} />
      )}
    </div>
  );
}
