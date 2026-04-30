import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";
import { TrendingUp, TrendingDown } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();

  const [
    { data: profile },
    { count: listingCount },
    { count: auctionCount },
    { data: paidOrders },
    { data: revenueOrders },
    { data: thisMonthOrders },
    { data: lastMonthOrders },
  ] = await Promise.all([
    supabase.from("profiles").select("username, bio, avatar_url, stripe_onboarded, plan").eq("id", user.id).single(),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
    supabase.from("orders").select("id, amount_cents, created_at, listing_id, auction_id, buyer_id, shipping_address").eq("seller_id", user.id).eq("status", "paid").order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]).gte("created_at", startOfThisMonth),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]).gte("created_at", startOfLastMonth).lt("created_at", startOfThisMonth),
  ]);

  const paidCount = paidOrders?.length ?? 0;
  const totalRevenue = (revenueOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const thisMonthRevenue = (thisMonthOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const lastMonthRevenue = (lastMonthOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const revenueChangePct = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  const plan = profile?.plan ?? "seedling";

  // Resolve item names and buyer usernames for recent orders
  let recentOrders: {
    id: string;
    amount_cents: number;
    created_at: string;
    plant_name: string;
    buyer_username: string;
    shipping_address: { name: string; line1: string; city: string; state: string; zip: string };
  }[] = [];

  if (paidOrders && paidOrders.length > 0) {
    const listingIds = paidOrders.filter((o) => o.listing_id).map((o) => o.listing_id!);
    const auctionIds = paidOrders.filter((o) => o.auction_id).map((o) => o.auction_id!);
    const buyerIds = [...new Set(paidOrders.map((o) => o.buyer_id))];

    const [{ data: listings }, { data: auctions }, { data: buyers }] = await Promise.all([
      listingIds.length ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds) : { data: [] },
      auctionIds.length ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds) : { data: [] },
      supabase.from("profiles").select("id, username").in("id", buyerIds),
    ]);

    const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
    const auctionMap = Object.fromEntries((auctions ?? []).map((a) => [a.id, a]));
    const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));

    recentOrders = paidOrders.map((o) => {
      const item = o.listing_id ? listingMap[o.listing_id] : o.auction_id ? auctionMap[o.auction_id] : null;
      const addr = o.shipping_address as { name: string; line1: string; city: string; state: string; zip: string };
      return {
        id: o.id,
        amount_cents: o.amount_cents,
        created_at: o.created_at,
        plant_name: item ? `${item.plant_name}${item.variety ? ` — ${item.variety}` : ""}` : "Unknown item",
        buyer_username: buyerMap[o.buyer_id]?.username ?? "unknown",
        shipping_address: addr,
      };
    });
  }

  // Onboarding checklist
  const checks = {
    profile: !!(profile?.bio && profile?.avatar_url),
    listing: (listingCount ?? 0) > 0 || (auctionCount ?? 0) > 0,
    stripe: !!profile?.stripe_onboarded,
  };
  const allDone = checks.profile && checks.listing && checks.stripe;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Seller Dashboard</h1>
          {profile?.username && (
            <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {profile.username}</p>
          )}
        </div>
        <Link href="/dashboard/create" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800 gap-1")}>
          + Add Inventory
        </Link>
      </div>

      {/* Onboarding checklist */}
      {!allDone && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-green-800">Get your shop ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CheckItem done={checks.profile} label="Complete your profile" href="/account" hint="Add a bio and profile photo so buyers trust you" />
            <CheckItem done={checks.listing} label="Add your first listing or auction" href="/dashboard/create" hint="List a plant to start selling" />
            <CheckItem done={checks.stripe} label="Connect your bank account" href="/account" hint="Required to receive payments via Stripe" />
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Listings" value={listingCount ?? 0} />
        <StatCard label="Live Auctions" value={auctionCount ?? 0} />
        <StatCard
          label="Orders to Ship"
          value={paidCount}
          highlight={paidCount > 0}
        />
        <StatCard
          label="This Month"
          value={centsToDisplay(thisMonthRevenue)}
          sub={`Platform only · All time: ${centsToDisplay(totalRevenue)}`}
          trend={revenueChangePct}
        />
      </div>

      {/* Main content: recent orders + quick nav */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent orders */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Orders awaiting shipment</h2>
            <Link href="/dashboard/orders" className="text-sm text-green-700 hover:underline">View all</Link>
          </div>
          {recentOrders.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground text-sm">
                No orders waiting to ship.
              </CardContent>
            </Card>
          ) : (
            recentOrders.map((order) => (
              <Card key={order.id} className="border-l-4 border-l-blue-400">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">{order.plant_name}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Buyer: <span className="font-medium text-foreground">{order.buyer_username}</span>
                        {" · "}{centsToDisplay(order.amount_cents)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        Ship to: {order.shipping_address.name} · {order.shipping_address.line1}, {order.shipping_address.city}, {order.shipping_address.state} {order.shipping_address.zip}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/orders"
                      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "shrink-0")}
                    >
                      Manage
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Quick nav */}
        <div className="space-y-3">
          <h2 className="font-semibold">Quick links</h2>
          <div className="flex flex-col gap-2">
            <NavLink href="/dashboard/inventory" label="Inventory" />
            <NavLink href="/dashboard/listings" label="Manage Listings" />
            <NavLink href="/dashboard/auctions" label="Manage Auctions" />
            <NavLink href="/dashboard/orders" label="View Orders" badge={paidCount > 0 ? paidCount : undefined} />
            <NavLink href="/dashboard/analytics" label="Analytics" badge={plan === "seedling" ? "Grower+" : undefined} badgeColor="green" />
            <NavLink href="/account" label="Account Settings" badge={!checks.stripe ? "!" : undefined} badgeColor="orange" />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, sub, trend }: { label: string; value: number | string; highlight?: boolean; sub?: string; trend?: number | null }) {
  return (
    <Card className={highlight ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800" : ""}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", highlight && "text-blue-700")}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend != null && (
          <p className={cn("text-xs font-semibold flex items-center gap-0.5 mt-1.5", trend >= 0 ? "text-green-700" : "text-red-600")}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? "+" : ""}{trend}% vs last month
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function CheckItem({ done, label, href, hint }: { done: boolean; label: string; href: string; hint: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-green-600 text-white" : "border-2 border-green-400 text-green-700")}>
        {done ? "✓" : ""}
      </div>
      <div>
        {done ? (
          <p className="text-sm font-medium text-green-800 line-through opacity-60">{label}</p>
        ) : (
          <Link href={href} className="text-sm font-medium text-green-800 hover:underline">{label}</Link>
        )}
        {!done && <p className="text-xs text-green-700/70 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

function NavLink({ href, label, badge, badgeColor = "blue" }: { href: string; label: string; badge?: number | string; badgeColor?: "blue" | "orange" | "green" }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 text-sm font-medium hover:bg-muted/40 transition-colors"
    >
      {label}
      {badge !== undefined && (
        <span className={cn(
          "rounded-full px-2 py-0.5 text-xs font-semibold",
          badgeColor === "orange" ? "bg-orange-100 text-orange-700" :
          badgeColor === "green"  ? "bg-green-100 text-green-700" :
          "bg-blue-100 text-blue-700"
        )}>
          {badge}
        </span>
      )}
    </Link>
  );
}
