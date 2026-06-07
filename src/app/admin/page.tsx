import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export default async function AdminOverviewPage() {
  const supabase = await createClient();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const stuckDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: userCount },
    { count: newUsers },
    { count: listingCount },
    { count: newListings },
    { count: auctionCount },
    { count: orderCount },
    { count: newOrders },
    { count: stuckOrders },
    { count: openDisputes },
    { count: pendingReports },
    { data: revenueRows },
    { data: recentUsers },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("listings").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("*", { count: "exact", head: true }).gte("created_at", since24h),
    admin.from("orders").select("*", { count: "exact", head: true }).eq("status", "paid").lt("created_at", stuckDate),
    admin.from("order_disputes").select("*", { count: "exact", head: true }).in("status", ["open", "seller_notified", "seller_responded"]),
    admin.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("orders").select("amount_cents").in("status", ["paid", "shipped", "delivered"]),
    supabase.from("profiles").select("id, username, created_at, stripe_onboarded, plan").order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("id, amount_cents, status, created_at, buyer_id, seller_id").order("created_at", { ascending: false }).limit(5),
  ]);

  const totalRevenue = (revenueRows ?? []).reduce((sum, o) => sum + o.amount_cents, 0);

  const allUserIds = [...new Set([
    ...(recentOrders ?? []).map(o => o.buyer_id),
    ...(recentOrders ?? []).map(o => o.seller_id),
  ])];
  const { data: orderProfiles } = allUserIds.length
    ? await supabase.from("profiles").select("id, username").in("id", allUserIds)
    : { data: [] };
  const profileMap = Object.fromEntries((orderProfiles ?? []).map(p => [p.id, p]));

  const alerts: { label: string; href: string }[] = [];
  if ((stuckOrders ?? 0) > 0) alerts.push({ label: `${stuckOrders} order${stuckOrders !== 1 ? "s" : ""} stuck in "paid" for 5+ days`, href: "/admin/orders" });
  if ((openDisputes ?? 0) > 0) alerts.push({ label: `${openDisputes} open dispute${openDisputes !== 1 ? "s" : ""} awaiting resolution`, href: "/admin/orders" });
  if ((pendingReports ?? 0) > 0) alerts.push({ label: `${pendingReports} pending report${pendingReports !== 1 ? "s" : ""} to review`, href: "/admin/reports" });

  const planLabel: Record<string, string> = {
    seedling: "Free",
    grower: "Grower",
    nursery: "Nursery",
  };

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide stats and recent activity.</p>
      </div>

      {alerts.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-semibold text-sm mb-1">
            <AlertTriangle size={16} />
            Action needed
          </div>
          {alerts.map((a) => (
            <div key={a.label} className="flex items-center justify-between">
              <p className="text-sm text-amber-700 dark:text-amber-400">{a.label}</p>
              <Link href={a.href} className="text-xs font-semibold text-amber-800 dark:text-amber-400 underline underline-offset-2 hover:opacity-70">
                View →
              </Link>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Users" value={userCount ?? 0} newToday={newUsers ?? 0} />
        <StatCard label="Active Listings" value={listingCount ?? 0} newToday={newListings ?? 0} />
        <StatCard label="Live Auctions" value={auctionCount ?? 0} />
        <StatCard label="Total Orders" value={orderCount ?? 0} newToday={newOrders ?? 0} />
        <StatCard label="Platform Revenue" value={centsToDisplay(totalRevenue)} colSpan />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h2 className="font-semibold mb-3">Recent Users</h2>
          <div className="rounded-lg border divide-y">
            {(recentUsers ?? []).map((u) => (
              <div key={u.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{u.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.created_at ? <>Joined {new Date(u.created_at).toLocaleDateString()}</> : null}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {u.plan && u.plan !== "seedling" && (
                    <span className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-full">
                      {planLabel[u.plan] ?? u.plan}
                    </span>
                  )}
                  {u.stripe_onboarded && (
                    <span className="text-xs bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage px-2 py-0.5 rounded-full">
                      Stripe connected
                    </span>
                  )}
                </div>
              </div>
            ))}
            {!recentUsers?.length && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No users yet.</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="font-semibold mb-3">Recent Orders</h2>
          <div className="rounded-lg border divide-y">
            {(recentOrders ?? []).map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{centsToDisplay(o.amount_cents)}</p>
                  <p className="text-xs text-muted-foreground">
                    {profileMap[o.buyer_id]?.username ?? "—"} → {profileMap[o.seller_id]?.username ?? "—"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  o.status === "delivered" ? "bg-[#DFE7D4] text-leaf" :
                  o.status === "shipped" ? "bg-blue-100 text-blue-700" :
                  o.status === "paid" ? "bg-yellow-100 text-yellow-700" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {o.status}
                </span>
              </div>
            ))}
            {!recentOrders?.length && (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">No orders yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, newToday, colSpan }: { label: string; value: number | string; newToday?: number; colSpan?: boolean }) {
  return (
    <Card className={colSpan ? "col-span-2 lg:col-span-1" : ""}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
        {newToday !== undefined && (
          <p className="text-xs text-muted-foreground mt-1">
            {newToday > 0 ? (
              <span className="text-leaf font-medium">+{newToday} today</span>
            ) : (
              <span>+0 today</span>
            )}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
