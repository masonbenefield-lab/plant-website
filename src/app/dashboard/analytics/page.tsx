import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Lock } from "lucide-react";
import RevenueChart from "./revenue-chart";

type Order = {
  id: string;
  amount_cents: number;
  created_at: string;
  listing_id: string | null;
  auction_id: string | null;
  shipping_address: { name: string; line1: string; city: string; state: string; zip: string; country: string };
};

function pct(next: number, prev: number): number | null {
  if (prev === 0) return null;
  return Math.round(((next - prev) / prev) * 100);
}

function TrendBadge({ change }: { change: number | null }) {
  if (change === null) return null;
  if (change === 0) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus size={12} /> flat vs last month</span>;
  const up = change > 0;
  return (
    <span className={cn("text-xs font-semibold flex items-center gap-0.5", up ? "text-green-700" : "text-red-600")}>
      {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
      {up ? "+" : ""}{change}% vs last month
    </span>
  );
}

function StatCard({ label, value, sub, trend }: { label: string; value: string | number; sub?: string; trend?: number | null }) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend !== undefined && <div className="mt-1.5"><TrendBadge change={trend} /></div>}
      </CardContent>
    </Card>
  );
}

function MiniBar({ value, max, label, sub }: { value: number; max: number; label: string; sub: string }) {
  const width = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium truncate mr-2">{label}</span>
        <span className="text-muted-foreground shrink-0">{sub}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div className="h-full bg-green-600 rounded-full" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, is_admin")
    .eq("id", user.id)
    .single();

  const plan: "seedling" | "grower" | "nursery" =
    profile?.is_admin ? "nursery" : (profile?.plan ?? "seedling");

  if (plan === "seedling") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-2">
          <Lock size={28} className="text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold">Analytics are a paid feature</h1>
        <p className="text-muted-foreground leading-relaxed">
          Upgrade to <strong>Grower</strong> to unlock revenue trends, order counts, average order value, and your top 5 best-performing listings.
          Upgrade to <strong>Nursery</strong> for the full suite — monthly revenue charts, per-listing breakdowns, auction stats, and buyer geography.
        </p>
        <Link href="/pricing" className={cn(buttonVariants({ size: "lg" }), "bg-green-700 hover:bg-green-800 text-white")}>
          View pricing
        </Link>
      </div>
    );
  }

  // --- Fetch all completed orders ---
  const { data: rawOrders } = await supabase
    .from("orders")
    .select("id, amount_cents, created_at, listing_id, auction_id, shipping_address")
    .eq("seller_id", user.id)
    .in("status", ["paid", "shipped", "delivered"])
    .order("created_at", { ascending: true });

  const orders = (rawOrders ?? []) as Order[];

  // Date boundaries
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const thisMonthOrders = orders.filter(o => new Date(o.created_at) >= startOfThisMonth);
  const lastMonthOrders = orders.filter(o => {
    const d = new Date(o.created_at);
    return d >= startOfLastMonth && d < startOfThisMonth;
  });

  const thisMonthRevenue = thisMonthOrders.reduce((s, o) => s + o.amount_cents, 0);
  const lastMonthRevenue = lastMonthOrders.reduce((s, o) => s + o.amount_cents, 0);
  const revenueChange = pct(thisMonthRevenue, lastMonthRevenue);
  const orderCountChange = pct(thisMonthOrders.length, lastMonthOrders.length);

  const totalRevenue = orders.reduce((s, o) => s + o.amount_cents, 0);
  const avgOrderValue = orders.length ? totalRevenue / orders.length : 0;

  // --- Top items by revenue ---
  const listingRevMap: Record<string, number> = {};
  const listingCountMap: Record<string, number> = {};
  const auctionRevMap: Record<string, number> = {};
  const auctionCountMap: Record<string, number> = {};

  for (const o of orders) {
    if (o.listing_id) {
      listingRevMap[o.listing_id] = (listingRevMap[o.listing_id] ?? 0) + o.amount_cents;
      listingCountMap[o.listing_id] = (listingCountMap[o.listing_id] ?? 0) + 1;
    }
    if (o.auction_id) {
      auctionRevMap[o.auction_id] = (auctionRevMap[o.auction_id] ?? 0) + o.amount_cents;
      auctionCountMap[o.auction_id] = (auctionCountMap[o.auction_id] ?? 0) + 1;
    }
  }

  const sortedListingIds = Object.entries(listingRevMap).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  const sortedAuctionIds = Object.entries(auctionRevMap).sort((a, b) => b[1] - a[1]).map(e => e[0]);

  const top5ListingIds = sortedListingIds.slice(0, 5);
  const top5AuctionIds = sortedAuctionIds.slice(0, 5);

  const [{ data: topListingsData }, { data: topAuctionsData }] = await Promise.all([
    top5ListingIds.length
      ? supabase.from("listings").select("id, plant_name, variety, category").in("id", top5ListingIds)
      : Promise.resolve({ data: [] }),
    top5AuctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety").in("id", top5AuctionIds)
      : Promise.resolve({ data: [] }),
  ]);

  type TopItem = { id: string; name: string; revenue: number; units: number };
  const topItems: TopItem[] = [
    ...(topListingsData ?? []).map(l => ({
      id: l.id,
      name: `${l.plant_name}${l.variety ? ` — ${l.variety}` : ""}`,
      revenue: listingRevMap[l.id] ?? 0,
      units: listingCountMap[l.id] ?? 0,
    })),
    ...(topAuctionsData ?? []).map(a => ({
      id: a.id,
      name: `${a.plant_name}${a.variety ? ` — ${a.variety}` : ""} (auction)`,
      revenue: auctionRevMap[a.id] ?? 0,
      units: auctionCountMap[a.id] ?? 0,
    })),
  ].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // --- Nursery extras ---
  let monthlyRevenue: { month: string; revenue: number }[] = [];
  let topStates: { state: string; count: number }[] = [];
  let categoryRevenue: { category: string; revenue: number }[] = [];
  let auctionStats = { total: 0, sold: 0, avgBids: 0 };
  let allItemRows: { name: string; revenue: number; units: number; avg: number }[] = [];

  if (plan === "nursery") {
    // Monthly revenue — last 6 months
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const rev = orders
        .filter(o => { const d = new Date(o.created_at); return d >= mStart && d < mEnd; })
        .reduce((s, o) => s + o.amount_cents, 0);
      monthlyRevenue.push({
        month: mStart.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
        revenue: rev / 100,
      });
    }

    // Buyer states
    const stateMap: Record<string, number> = {};
    for (const o of orders) {
      const state = (o.shipping_address as { state?: string })?.state;
      if (state) stateMap[state] = (stateMap[state] ?? 0) + 1;
    }
    topStates = Object.entries(stateMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([state, count]) => ({ state, count }));

    // Category revenue — from listings that have sales
    const allListingIds = sortedListingIds;
    if (allListingIds.length) {
      const { data: allListingsWithCat } = await supabase
        .from("listings")
        .select("id, plant_name, variety, category")
        .in("id", allListingIds);

      const catRevMap: Record<string, number> = {};
      for (const l of allListingsWithCat ?? []) {
        const cat = l.category ?? "Uncategorized";
        catRevMap[cat] = (catRevMap[cat] ?? 0) + (listingRevMap[l.id] ?? 0);
      }
      categoryRevenue = Object.entries(catRevMap)
        .sort((a, b) => b[1] - a[1])
        .map(([category, revenue]) => ({ category, revenue }));

      // Full per-item breakdown
      allItemRows = [
        ...(allListingsWithCat ?? []).map(l => ({
          name: `${l.plant_name}${l.variety ? ` — ${l.variety}` : ""}`,
          revenue: listingRevMap[l.id] ?? 0,
          units: listingCountMap[l.id] ?? 0,
          avg: listingCountMap[l.id] ? (listingRevMap[l.id] ?? 0) / listingCountMap[l.id] : 0,
        })),
      ].sort((a, b) => b.revenue - a.revenue);
    }

    // Auction stats
    const { data: sellerAuctions } = await supabase
      .from("auctions")
      .select("id, status")
      .eq("seller_id", user.id);

    const auctionIds = (sellerAuctions ?? []).map(a => a.id);
    const { data: allBids } = auctionIds.length
      ? await supabase.from("bids").select("auction_id").in("auction_id", auctionIds)
      : { data: [] };

    const bidCountMap: Record<string, number> = {};
    for (const b of allBids ?? []) {
      bidCountMap[b.auction_id] = (bidCountMap[b.auction_id] ?? 0) + 1;
    }
    const totalBids = Object.values(bidCountMap).reduce((s, v) => s + v, 0);
    auctionStats = {
      total: sellerAuctions?.length ?? 0,
      sold: (sellerAuctions ?? []).filter(a => a.status === "ended").length,
      avgBids: auctionIds.length ? Math.round((totalBids / auctionIds.length) * 10) / 10 : 0,
    };
  }

  const maxTopRevenue = topItems[0]?.revenue ?? 1;
  const maxStateCount = topStates[0]?.count ?? 1;
  const maxCatRevenue = categoryRevenue[0]?.revenue ?? 1;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5 capitalize">{plan} plan</p>
        </div>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          ← Dashboard
        </Link>
      </div>

      {/* This month summary */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">This month</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Revenue"
            value={centsToDisplay(thisMonthRevenue)}
            sub={`Last month: ${centsToDisplay(lastMonthRevenue)}`}
            trend={revenueChange}
          />
          <StatCard
            label="Orders"
            value={thisMonthOrders.length}
            sub={`Last month: ${lastMonthOrders.length}`}
            trend={orderCountChange}
          />
          <StatCard
            label="Avg order value"
            value={centsToDisplay(avgOrderValue)}
            sub="all time"
          />
          <StatCard
            label="Total revenue"
            value={centsToDisplay(totalRevenue)}
            sub="all time · paid + shipped + delivered"
          />
        </div>
      </div>

      {/* Monthly chart — Nursery only */}
      {plan === "nursery" && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Revenue — last 6 months</h2>
          <Card>
            <CardContent className="pt-6">
              {monthlyRevenue.every(m => m.revenue === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-8">No sales in the last 6 months yet.</p>
              ) : (
                <RevenueChart data={monthlyRevenue} />
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Top 5 items */}
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          {plan === "nursery" ? "Top items by revenue" : "Top 5 items by revenue"}
        </h2>
        <Card>
          <CardContent className="pt-6">
            {topItems.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No sales yet — your top performers will appear here.</p>
            ) : (
              <div className="space-y-4">
                {topItems.map((item) => (
                  <MiniBar
                    key={item.id}
                    value={item.revenue}
                    max={maxTopRevenue}
                    label={item.name}
                    sub={`${centsToDisplay(item.revenue)} · ${item.units} sold`}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Nursery: full per-item breakdown */}
      {plan === "nursery" && allItemRows.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Per-listing breakdown</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="px-4 py-3 text-left font-medium">Item</th>
                      <th className="px-4 py-3 text-right font-medium">Units sold</th>
                      <th className="px-4 py-3 text-right font-medium">Revenue</th>
                      <th className="px-4 py-3 text-right font-medium">Avg price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItemRows.map((row, i) => (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium">{row.name}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{row.units}</td>
                        <td className="px-4 py-3 text-right font-semibold">{centsToDisplay(row.revenue)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{centsToDisplay(row.avg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Nursery: auction stats */}
      {plan === "nursery" && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Auction performance</h2>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Total auctions" value={auctionStats.total} />
            <StatCard
              label="Ended with a sale"
              value={auctionStats.total > 0 ? `${Math.round((auctionStats.sold / auctionStats.total) * 100)}%` : "—"}
              sub={`${auctionStats.sold} of ${auctionStats.total}`}
            />
            <StatCard label="Avg bids per auction" value={auctionStats.avgBids || "—"} />
          </div>
        </div>
      )}

      {/* Nursery: buyer geography */}
      {plan === "nursery" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {topStates.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Top buyer states</h2>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  {topStates.map(({ state, count }) => (
                    <MiniBar
                      key={state}
                      value={count}
                      max={maxStateCount}
                      label={state}
                      sub={`${count} order${count !== 1 ? "s" : ""}`}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {categoryRevenue.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Revenue by category</h2>
              <Card>
                <CardContent className="pt-6 space-y-3">
                  {categoryRevenue.map(({ category, revenue }) => (
                    <MiniBar
                      key={category}
                      value={revenue}
                      max={maxCatRevenue}
                      label={category}
                      sub={centsToDisplay(revenue)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Grower upgrade teaser */}
      {plan === "grower" && (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center space-y-3">
            <p className="font-semibold">Want more depth?</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Upgrade to <strong>Nursery</strong> to unlock a monthly revenue chart, full per-listing breakdown, auction performance stats, buyer geography, and category revenue.
            </p>
            <Link href="/pricing" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800 text-white")}>
              See Nursery plan
            </Link>
          </CardContent>
        </Card>
      )}

    </div>
  );
}
