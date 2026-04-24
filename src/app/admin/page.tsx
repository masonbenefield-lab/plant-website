import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";

export default async function AdminOverviewPage() {
  const supabase = await createClient();

  const [
    { count: userCount },
    { count: listingCount },
    { count: auctionCount },
    { count: orderCount },
    { data: revenueRows },
    { data: recentUsers },
    { data: recentOrders },
  ] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("orders").select("*", { count: "exact", head: true }),
    supabase.from("orders").select("amount_cents").in("status", ["paid", "shipped", "delivered"]),
    supabase.from("profiles").select("id, username, created_at, stripe_onboarded").order("created_at", { ascending: false }).limit(5),
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

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide stats and recent activity.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard label="Total Users" value={userCount ?? 0} />
        <StatCard label="Active Listings" value={listingCount ?? 0} />
        <StatCard label="Live Auctions" value={auctionCount ?? 0} />
        <StatCard label="Total Orders" value={orderCount ?? 0} />
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
                    Joined {new Date(u.created_at).toLocaleDateString()}
                  </p>
                </div>
                {u.stripe_onboarded && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">
                    Stripe connected
                  </span>
                )}
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
                  o.status === "delivered" ? "bg-green-100 text-green-700" :
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

function StatCard({ label, value, colSpan }: { label: string; value: number | string; colSpan?: boolean }) {
  return (
    <Card className={colSpan ? "col-span-2 lg:col-span-1" : ""}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}
