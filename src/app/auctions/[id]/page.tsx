import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import AuctionBidPanel from "./auction-bid-panel";
import WishlistButton from "@/components/wishlist-button";
import ReportButton from "@/components/report-button";
import ImageGallery from "@/components/image-gallery";
import ListingShareButton from "@/components/listing-share-button";
import { ShippingEstimate } from "@/components/shipping-estimate";
import { ReturnPolicyBadge } from "@/components/return-policy-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("auctions")
    .select("plant_name, variety, description, images, current_bid_cents")
    .eq("id", id)
    .single();

  if (!data) return { title: "Auction Not Found — Plantet" };

  const title = data.variety
    ? `${data.plant_name} ${data.variety} — Live Auction on Plantet`
    : `${data.plant_name} — Live Auction on Plantet`;
  const description =
    data.description ||
    `Bid on ${data.plant_name} on Plantet. Current bid: ${centsToDisplay(data.current_bid_cents)}`;
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.com").replace(/\/$/, "");

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: `${siteUrl}/api/og?type=auction&id=${id}`, width: 1200, height: 630 }],
    },
  };
}

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

  const [{ data: seller }, { data: bids }, { data: { user } }, { data: invShipping }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, shipping_days, shipping_days_max, return_policy_type, return_policy_notes, calculated_shipping_enabled").eq("id", auction.seller_id).single(),
    supabase.from("bids").select("id, amount_cents, created_at, bidder_id").eq("auction_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.auth.getUser(),
    auction.inventory_id
      ? supabase.from("inventory").select("free_shipping, shipping_cost_cents, shipping_weight_oz").eq("id", auction.inventory_id).single()
      : Promise.resolve({ data: null }),
  ]);

  const shippingFree = invShipping?.free_shipping ?? auction.free_shipping;
  const shippingCostCents = invShipping?.shipping_cost_cents ?? auction.shipping_cost_cents;

  const bidderIds = [...new Set(bids?.map((b) => b.bidder_id) ?? [])];
  const { data: bidders } = bidderIds.length
    ? await supabase.from("profiles").select("id, username").in("id", bidderIds)
    : { data: [] };
  const bidderMap = Object.fromEntries((bidders ?? []).map((b) => [b.id, b]));

  const [wishlistRow, reportRow, buyerProfile, existingOrderRow] = await Promise.all([
    user ? supabase.from("wishlists").select("id").eq("user_id", user.id).eq("auction_id", auction.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("reports").select("id").eq("reporter_id", user.id).eq("auction_id", auction.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("profiles").select("default_payment_method_id, saved_shipping_address").eq("id", user.id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("orders").select("id, status").eq("auction_id", auction.id).eq("buyer_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isWishlisted = !!wishlistRow.data;
  const isReported = !!reportRow.data;
  const existingOrderStatus = existingOrderRow.data?.status ?? null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Link href="/auctions" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        Back to Auctions
      </Link>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div>
          <ImageGallery images={auction.images as string[]} alt={auction.plant_name} />
        </div>

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold">{auction.plant_name}</h1>
                <Badge
                  variant={auction.status === "active" ? "default" : "secondary"}
                  className={auction.status === "active" ? "bg-leaf" : auction.status === "scheduled" ? "bg-blue-600 text-white" : ""}
                >
                  {auction.status === "scheduled" ? "Upcoming" : auction.status}
                </Badge>
                {auction.status === "ended" && auction.reserve_price_cents && auction.current_bid_cents < auction.reserve_price_cents && (
                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Reserve not met
                  </Badge>
                )}
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
            <div className="flex items-center gap-2">
              <ListingShareButton title={auction.plant_name} />
              <WishlistButton userId={user?.id ?? null} auctionId={auction.id} initialWishlisted={isWishlisted} />
            </div>
          </div>

          {auction.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-3 mb-3">
              {auction.description}
            </p>
          )}

          {auction.status === "scheduled" && auction.starts_at && (
            <div className="mb-4 rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-300">
              🕐 This auction opens on {new Date(auction.starts_at).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </div>
          )}

          <AuctionBidPanel
            auction={{
              id: auction.id,
              status: auction.status,
              current_bid_cents: auction.current_bid_cents,
              starting_bid_cents: auction.starting_bid_cents,
              buy_now_price_cents: auction.buy_now_price_cents,
              reserve_price_cents: auction.reserve_price_cents,
              ends_at: auction.ends_at,
              seller_id: auction.seller_id,
              current_bidder_id: auction.current_bidder_id,
              free_shipping: shippingFree ?? null,
              shipping_cost_cents: shippingCostCents ?? null,
              shipping_weight_oz: invShipping?.shipping_weight_oz ?? auction.shipping_weight_oz ?? null,
            }}
            userId={user?.id ?? null}
            buyerHasPaymentMethod={!!buyerProfile?.data?.default_payment_method_id}
            buyerHasShippingAddress={!!buyerProfile?.data?.saved_shipping_address}
            existingOrderStatus={existingOrderStatus}
            showShippingEstimate={(seller as { calculated_shipping_enabled?: boolean } | null)?.calculated_shipping_enabled !== false}
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
              className="inline-flex items-center gap-2 mb-4 text-sm hover:underline"
            >
              <Avatar className="h-6 w-6">
                <AvatarImage src={seller.avatar_url ?? undefined} />
                <AvatarFallback className="bg-[#DFE7D4] text-leaf text-xs">
                  {(seller.display_name ?? seller.username).slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium">{seller.display_name ?? seller.username}</span>
              <span className="text-muted-foreground">· View storefront →</span>
            </Link>
          )}

          <div className="mb-4 space-y-2">
            {seller?.shipping_days && (
              <p className="text-xs text-muted-foreground">
                🚚 Ships within {seller.shipping_days}{(seller as { shipping_days_max?: number | null }).shipping_days_max ? `–${(seller as { shipping_days_max?: number | null }).shipping_days_max}` : ""} day{((seller as { shipping_days_max?: number | null }).shipping_days_max ?? seller.shipping_days) !== 1 ? "s" : ""}
              </p>
            )}
            {(seller as { return_policy_type?: string | null } | null)?.return_policy_type && (
              <ReturnPolicyBadge
                type={(seller as { return_policy_type: string }).return_policy_type}
                notes={(seller as { return_policy_notes?: string | null }).return_policy_notes}
              />
            )}
          </div>

          {user && user.id !== auction.seller_id && (
            <div className="mt-4 flex justify-end">
              <ReportButton
                userId={user.id}
                auctionId={auction.id}
                targetName={auction.plant_name}
                initialReported={isReported}
              />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
