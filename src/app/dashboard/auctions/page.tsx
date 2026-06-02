export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { Pagination } from "@/components/pagination";
import DashboardSearch from "@/components/dashboard-search";
import { DeleteScheduledAuctionButton, DeleteEndedAuctionButton, AcceptHighestBidButton, ForceCloseButton } from "./auction-actions";
import AuctionActions from "./auction-actions";
import NewAuctionDialog from "./new-auction-dialog";
import { LocalDate } from "@/components/local-date";
import type { Database } from "@/lib/supabase/types";

const PAGE_SIZE = 25;

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function tabHref(tab: string, extras?: string) {
  return `/dashboard/auctions?tab=${tab}${extras ?? ""}`;
}

export default async function DashboardAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string; q?: string }>;
}) {
  const { tab = "selling", page: pageParam, q } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, stripe_onboarded, plan, is_admin, ship_from_address, calculated_shipping_enabled")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/auctions");
  }

  const stripeOnboarded = !!profile?.stripe_onboarded;
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;
  const shipFromAddr = (profile as { ship_from_address?: { street1?: string; city?: string; zip?: string } | null } | null)?.ship_from_address;
  const hasShipFrom = !!(shipFromAddr?.street1?.trim() && shipFromAddr?.city?.trim() && shipFromAddr?.zip?.trim());
  const calculatedShippingEnabled = hasShipFrom && (profile as { calculated_shipping_enabled?: boolean | null } | null)?.calculated_shipping_enabled === true;
  const admin = adminClient();

  const { getPlanLimits } = await import("@/lib/plan-limits");
  const planLimits = getPlanLimits((profile as { plan?: string } | null)?.plan as "seedling" | "grower" | "nursery" | null, isAdmin);

  // ── Selling tab ──────────────────────────────────────────────────────────
  type AuctionRow = Database["public"]["Tables"]["auctions"]["Row"];
  let sellingAuctions: AuctionRow[] = [];
  let sellingTotal = 0;
  let sellingTotalPages = 0;
  let activeAuctionCount = 0;

  if (tab === "selling") {
    let auctionsQuery = supabase
      .from("auctions")
      .select("*", { count: "exact" })
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false });

    if (q) auctionsQuery = auctionsQuery.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);
    const [{ data: auctions, count }, { count: activeCount }] = await Promise.all([
      auctionsQuery.range(from, to),
      supabase.from("auctions").select("id", { count: "exact", head: true }).eq("seller_id", user.id).in("status", ["active", "scheduled"]),
    ]);
    sellingAuctions = (auctions ?? []) as AuctionRow[];
    sellingTotal = count ?? 0;
    sellingTotalPages = Math.ceil(sellingTotal / PAGE_SIZE);
    activeAuctionCount = activeCount ?? 0;
  }

  // ── Bidding tabs ──────────────────────────────────────────────────────────
  type BidAuction = {
    id: string;
    plant_name: string;
    variety: string | null;
    current_bid_cents: number;
    current_bidder_id: string | null;
    status: string;
    ends_at: string;
    images: string[] | null;
    seller_id: string;
  };
  let activeBidAuctions: BidAuction[] = [];
  let historyAuctions: BidAuction[] = [];
  let highBidMap: Record<string, number> = {};

  if (tab === "active-bids" || tab === "history") {
    const { data: bids } = await admin
      .from("bids")
      .select("auction_id, amount_cents")
      .eq("bidder_id", user.id)
      .order("created_at", { ascending: false });

    const auctionIds = [...new Set((bids ?? []).map((b) => b.auction_id))];

    for (const b of bids ?? []) {
      if (!highBidMap[b.auction_id] || b.amount_cents > highBidMap[b.auction_id]) {
        highBidMap[b.auction_id] = b.amount_cents;
      }
    }

    if (auctionIds.length) {
      const { data: allAuctions } = await admin
        .from("auctions")
        .select("id, plant_name, variety, current_bid_cents, current_bidder_id, status, ends_at, images, seller_id")
        .in("id", auctionIds)
        .order("ends_at", { ascending: true });

      for (const a of allAuctions ?? []) {
        const row = { ...a, images: a.images as string[] | null };
        if (a.status === "active") activeBidAuctions.push(row);
        else historyAuctions.push(row);
      }
    }
  }

  const tabs = [
    { key: "selling", label: "Selling" },
    { key: "active-bids", label: "Active Bids" },
    { key: "history", label: "Bid History" },
  ];

  const tabClass = (key: string) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      tab === key
        ? "border-leaf text-leaf"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Auctions</h1>
        {tab === "selling" && (
          <NewAuctionDialog
            sellerId={user.id}
            planLimit={planLimits.auctions}
            currentCount={activeAuctionCount}
            photoLimit={planLimits.photos}
            calculatedShippingEnabled={calculatedShippingEnabled}
          />
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map(({ key, label }) => (
          <Link key={key} href={tabHref(key)} className={tabClass(key)}>
            {label}
          </Link>
        ))}
      </div>

      {/* ── Selling ──────────────────────────────────────────────────────── */}
      {tab === "selling" && (
        <>
          <div className="mb-6">
            <DashboardSearch placeholder="Search auctions…" basePath="/dashboard/auctions" />
          </div>
          {!stripeOnboarded && sellingAuctions.length > 0 && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
              <strong>Your auctions are not visible to buyers yet.</strong> They appear on your personal storefront, but won&apos;t show in the public auctions page and cannot be bid on until you{" "}
              <a href="/account#seller-payments" className="underline font-medium hover:opacity-80">connect your Stripe account</a>.
            </div>
          )}
          {sellingAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed">
              <div className="text-4xl mb-3">🔨</div>
              <h2 className="text-lg font-semibold mb-1">No auctions yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                Click <strong>+ New Auction</strong> above to set a starting bid, optional Buy Now price, and an end time.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sellingAuctions.map((auction) => (
                <Card key={auction.id}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{auction.plant_name}</span>
                        {auction.variety && (
                          <span className="text-sm text-muted-foreground">— {auction.variety}</span>
                        )}
                        <Badge
                          variant={auction.status === "active" ? "default" : "secondary"}
                          className={auction.status === "active" ? "bg-leaf" : ""}
                        >
                          {auction.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                        <span>Starting: {centsToDisplay(auction.starting_bid_cents)}</span>
                        <span>Current: {centsToDisplay(auction.current_bid_cents)}</span>
                        {auction.buy_now_price_cents && (
                          <span className="text-orange-600 font-medium">Buy Now: {centsToDisplay(auction.buy_now_price_cents)}</span>
                        )}
                        {auction.reserve_price_cents && (
                          <span className="text-muted-foreground">Reserve: {centsToDisplay(auction.reserve_price_cents)}</span>
                        )}
                        <span>
                          {(auction as { free_shipping?: boolean | null }).free_shipping
                            ? "Free shipping"
                            : (auction as { shipping_weight_oz?: number | null }).shipping_weight_oz
                              ? "Weight-based shipping"
                              : (auction as { shipping_cost_cents?: number | null }).shipping_cost_cents
                                ? `Shipping: ${centsToDisplay((auction as { shipping_cost_cents: number }).shipping_cost_cents)}`
                                : "Shipping: not set"}
                        </span>
                        {auction.status === "scheduled" && (auction as { starts_at?: string | null }).starts_at
                          ? <span>Goes live: <LocalDate iso={(auction as { starts_at: string }).starts_at} /></span>
                          : <span>Ends: <LocalDate iso={auction.ends_at} /></span>
                        }
                        {auction.status === "ended" && !auction.current_bidder_id && (
                          <span className="text-muted-foreground italic">No bids received</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {auction.status === "active" && (
                        <>
                          <Link href={`/auctions/${auction.id}`} className="text-sm text-muted-foreground hover:underline">
                            View →
                          </Link>
                          {isAdmin && (
                            <ForceCloseButton auctionId={auction.id} plantName={auction.plant_name} />
                          )}
                          <AuctionActions auctionId={auction.id} />
                        </>
                      )}
                      {auction.status === "scheduled" && (
                        <DeleteScheduledAuctionButton auctionId={auction.id} />
                      )}
                      {(auction.status === "ended" || auction.status === "cancelled" || auction.status === "expired") && (
                        <div className="flex items-center gap-2">
                          {/* Reserve offer button — ended auctions where reserve was not met and no offer sent yet */}
                          {auction.status === "ended" &&
                            auction.current_bidder_id &&
                            auction.reserve_price_cents &&
                            auction.current_bid_cents < auction.reserve_price_cents &&
                            !auction.reserve_offer_status && (
                              <AcceptHighestBidButton
                                auctionId={auction.id}
                                bidCents={auction.current_bid_cents}
                                plantName={auction.plant_name}
                              />
                            )}
                          {/* Reserve offer status badge */}
                          {auction.reserve_offer_status && (
                            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                              auction.reserve_offer_status === "accepted" ? "bg-[#EBF0E6] text-leaf" :
                              auction.reserve_offer_status === "pending" ? "bg-amber-50 text-amber-700" :
                              "bg-muted text-muted-foreground"
                            }`}>
                              Offer: {auction.reserve_offer_status}
                            </span>
                          )}
                          {auction.status === "ended" && !auction.current_bidder_id && (
                            <NewAuctionDialog
                              sellerId={user.id}
                              planLimit={planLimits.auctions}
                              currentCount={activeAuctionCount}
                              photoLimit={planLimits.photos}
                              calculatedShippingEnabled={calculatedShippingEnabled}
                              prefill={auction}
                              triggerLabel="Relist"
                            />
                          )}
                          <DeleteEndedAuctionButton auctionId={auction.id} />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          <Pagination
            page={page}
            totalPages={sellingTotalPages}
            total={sellingTotal}
            pageSize={PAGE_SIZE}
            prevHref={page > 1 ? `/dashboard/auctions?tab=selling&page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
            nextHref={page < sellingTotalPages ? `/dashboard/auctions?tab=selling&page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
          />
        </>
      )}

      {/* ── Active Bids ───────────────────────────────────────────────────── */}
      {tab === "active-bids" && (
        <>
          {activeBidAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed">
              <div className="text-4xl mb-3">🏷️</div>
              <h2 className="text-lg font-semibold mb-1">No active bids</h2>
              <p className="text-sm text-muted-foreground max-w-sm mb-5">
                You aren&apos;t currently bidding on any live auctions. Browse the auction house to find something you like.
              </p>
              <Link
                href="/auctions"
                className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors"
              >
                Browse Auctions →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activeBidAuctions.map((a) => {
                const isWinning = a.current_bidder_id === user.id;
                const myBid = highBidMap[a.id];
                const img = a.images?.[0];
                return (
                  <Link key={a.id} href={`/auctions/${a.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                          {img ? (
                            <Image src={img} alt={a.plant_name} fill className="object-cover" sizes="56px" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xl">🌿</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {a.plant_name}{a.variety ? ` ${a.variety}` : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isWinning ? "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                              {isWinning ? "Winning" : "Outbid"}
                            </span>
                            <span>Your bid: <span className="font-medium text-foreground">{centsToDisplay(myBid)}</span></span>
                            {!isWinning && (
                              <span>Current: <span className="font-medium text-leaf">{centsToDisplay(a.current_bid_cents)}</span></span>
                            )}
                            <span>Ends: <LocalDate iso={a.ends_at} /></span>
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-semibold text-leaf underline underline-offset-2">
                          {isWinning ? "View →" : "Bid again →"}
                        </span>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Bid History ───────────────────────────────────────────────────── */}
      {tab === "history" && (
        <>
          {historyAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed">
              <div className="text-4xl mb-3">📋</div>
              <h2 className="text-lg font-semibold mb-1">No bid history yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                Past auctions you&apos;ve bid on will appear here once they end.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyAuctions.map((a) => {
                const won = a.status === "ended" && a.current_bidder_id === user.id;
                const noWinner = a.status === "ended" && !a.current_bidder_id;
                const myBid = highBidMap[a.id];
                const img = a.images?.[0];
                let badgeLabel = "Ended";
                let badgeClass = "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
                if (won) { badgeLabel = "Won"; badgeClass = "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage"; }
                else if (noWinner) { badgeLabel = "No winner"; }
                return (
                  <Link key={a.id} href={won ? `/checkout?auction=${a.id}` : `/auctions/${a.id}`}>
                    <Card className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                          {img ? (
                            <Image src={img} alt={a.plant_name} fill className="object-cover" sizes="56px" />
                          ) : (
                            <div className="flex items-center justify-center h-full text-xl">🌿</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">
                            {a.plant_name}{a.variety ? ` ${a.variety}` : ""}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
                              {badgeLabel}
                            </span>
                            <span>Your bid: <span className="font-medium text-foreground">{centsToDisplay(myBid)}</span></span>
                            {!won && a.current_bid_cents !== myBid && (
                              <span>Winning bid: <span className="font-medium text-foreground">{centsToDisplay(a.current_bid_cents)}</span></span>
                            )}
                            <span>Ended: <LocalDate iso={a.ends_at} /></span>
                          </div>
                        </div>
                        {won && (
                          <span className="shrink-0 text-sm font-semibold text-leaf underline underline-offset-2">
                            Complete purchase →
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
