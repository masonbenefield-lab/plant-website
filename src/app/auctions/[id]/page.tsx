import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionBidPanel from "./auction-bid-panel";
import WishlistButton from "@/components/wishlist-button";

export default async function AuctionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: auction } = await supabase
    .from("auctions")
    .select("*")
    .eq("id", id)
    .single();

  if (!auction) notFound();

  const [{ data: seller }, { data: bids }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").eq("id", auction.seller_id).single(),
    supabase.from("bids").select("id, amount_cents, created_at, bidder_id").eq("auction_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.auth.getUser(),
  ]);

  const bidderIds = [...new Set(bids?.map((b) => b.bidder_id) ?? [])];
  const { data: bidders } = bidderIds.length
    ? await supabase.from("profiles").select("id, username").in("id", bidderIds)
    : { data: [] };
  const bidderMap = Object.fromEntries((bidders ?? []).map((b) => [b.id, b]));

  const wishlistRow = user ? await supabase
    .from("wishlists")
    .select("id")
    .eq("user_id", user.id)
    .eq("auction_id", auction.id)
    .maybeSingle() : null;
  const isWishlisted = !!wishlistRow?.data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative h-96 rounded-xl overflow-hidden bg-muted">
            {auction.images[0] ? (
              <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-6xl">🌿</div>
            )}
          </div>
          {auction.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {auction.images.slice(1).map((url, i) => (
                <div key={i} className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image src={url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{auction.plant_name}</h1>
                <Badge
                  variant={auction.status === "active" ? "default" : "secondary"}
                  className={auction.status === "active" ? "bg-green-700" : ""}
                >
                  {auction.status}
                </Badge>
              </div>
              {auction.variety && (
                <p className="text-muted-foreground mt-1">{auction.variety}</p>
              )}
              {auction.category && (
                <span className="inline-block mt-2 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
                  {auction.category}
                </span>
              )}
            </div>
            <WishlistButton userId={user?.id ?? null} auctionId={auction.id} initialWishlisted={isWishlisted} />
          </div>

          {auction.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 mt-3">
              {auction.description}
            </p>
          )}

          <AuctionBidPanel
            auction={{
              id: auction.id,
              status: auction.status,
              current_bid_cents: auction.current_bid_cents,
              starting_bid_cents: auction.starting_bid_cents,
              ends_at: auction.ends_at,
              seller_id: auction.seller_id,
              current_bidder_id: auction.current_bidder_id,
            }}
            userId={user?.id ?? null}
            recentBids={
              (bids ?? []).map((b) => ({
                id: b.id,
                amount_cents: b.amount_cents,
                created_at: b.created_at,
                bidder: bidderMap[b.bidder_id] ?? null,
              }))
            }
          />

          {seller && (
            <Link
              href={`/sellers/${seller.username}`}
              className="flex items-center gap-3 mt-8 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={seller.avatar_url ?? undefined} />
                <AvatarFallback className="bg-green-100 text-green-700">
                  {seller.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{seller.username}</p>
                <p className="text-xs text-muted-foreground">View storefront →</p>
              </div>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
