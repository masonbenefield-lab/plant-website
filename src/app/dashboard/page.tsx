import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";
import { TrendingUp, TrendingDown } from "lucide-react";
import { GroundbreakerBanner } from "@/components/groundbreaker-banner";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";

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
    { count: followerCount },
    { count: inventoryCount },
    { count: gardenPlantCount },
    { data: paidOrders },
    { data: revenueOrders },
    { data: thisMonthOrders },
    { data: lastMonthOrders },
    { count: purchaseCount },
    { count: wishlistCount },
    { count: followingCount },
    { count: groundbreakerCount },
  ] = await Promise.all([
    supabase.from("profiles").select("username, bio, avatar_url, stripe_onboarded, plan, garden_public, groundbreaker, groundbreaker_number, ship_from_address, return_policy_type, shipping_days").eq("id", user.id).single(),
    supabase.from("listings").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
    supabase.from("auctions").select("*", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "active"),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("seller_id", user.id),
    supabase.from("inventory").select("*", { count: "exact", head: true }).eq("seller_id", user.id),
    supabase.from("garden_plants").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("orders").select("id, amount_cents, created_at, listing_id, auction_id, buyer_id, shipping_address").eq("seller_id", user.id).eq("status", "paid").order("created_at", { ascending: false }).limit(5),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]).gte("created_at", startOfThisMonth),
    supabase.from("orders").select("amount_cents").eq("seller_id", user.id).in("status", ["paid", "shipped", "delivered"]).gte("created_at", startOfLastMonth).lt("created_at", startOfThisMonth),
    supabase.from("orders").select("*", { count: "exact", head: true }).eq("buyer_id", user.id),
    supabase.from("wishlists").select("*", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", user.id),
    supabase.from("profiles").select("*", { count: "exact", head: true }).eq("groundbreaker", true),
  ]);

  const paidCount = paidOrders?.length ?? 0;
  const totalRevenue = (revenueOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const thisMonthRevenue = (thisMonthOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const lastMonthRevenue = (lastMonthOrders ?? []).reduce((sum, o) => sum + o.amount_cents, 0);
  const revenueChangePct = lastMonthRevenue > 0
    ? Math.round(((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
    : null;

  const plan = profile?.plan ?? "seedling";
  const isSellerMode = !!profile?.stripe_onboarded || (inventoryCount ?? 0) > 0 || (listingCount ?? 0) > 0 || (auctionCount ?? 0) > 0;
  const spotsLeft = GROUNDBREAKER_CAP - (groundbreakerCount ?? 0);
  const showGroundbreakerBanner = !profile?.groundbreaker && spotsLeft > 0;

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
  const hasListing = (listingCount ?? 0) > 0 || (auctionCount ?? 0) > 0;
  const checks = {
    profile:       !!(profile?.bio && profile?.avatar_url),
    stripe:        !!profile?.stripe_onboarded,
    shipping:      !!((profile?.ship_from_address as { street1?: string } | null)?.street1),
    shippingTimeline: !!(profile as { shipping_days?: number | null } | null)?.shipping_days,
    returnPolicy:     !!(profile as { return_policy_type?: string | null } | null)?.return_policy_type,
    inventory:     (inventoryCount ?? 0) > 0,
    listing:       hasListing,
    storefront:    !!profile?.username && hasListing,
    garden:        (gardenPlantCount ?? 0) > 0 && !!profile?.garden_public,
  };
  // garden is optional — don't block allDone on it
  const { garden: _garden, ...coreChecks } = checks;
  const allDone = Object.values(coreChecks).every(Boolean);

  if (!isSellerMode) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        <div>
          <h1 className="text-2xl font-bold">My Account</h1>
          {profile?.username && (
            <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {profile.username}</p>
          )}
        </div>

        {showGroundbreakerBanner && <GroundbreakerBanner spotsLeft={spotsLeft} />}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="My Purchases" value={purchaseCount ?? 0} href="/orders" />
          <StatCard label="Wishlist" value={wishlistCount ?? 0} href="/wishlist" />
          <StatCard label="Following" value={followingCount ?? 0} href="/following" />
          <StatCard label="My Garden" value={gardenPlantCount ?? 0} href="/garden" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <NavLink href="/orders" label="My Purchases" />
          <NavLink href="/wishlist" label="Wishlist" />
          <NavLink href="/feed" label="Feed" />
          <NavLink href="/messages" label="Messages" />
          <NavLink href="/garden" label="My Garden" />
          <NavLink href="/community" label="Community" />
          <NavLink href="/account" label="Account Settings" />
        </div>

        <Card className="border-[#C5D4BC] bg-[#EBF0E6]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-forest">Get your shop ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CheckItem done={checks.profile}          label="Complete your profile"                         href="/account"                   hint="Add a bio and profile photo so buyers trust you" />
            <CheckItem done={checks.stripe}           label="Connect your bank account"                     href="/account#seller-payments"   hint="Required to receive payments — connect your bank via Stripe before listing" />
            <CheckItem done={checks.shipping}         label="Set up your ship-from address &amp; shipping preferences" href="/account#shipping-settings" hint="Required for calculated shipping rates and auto labels" />
            <CheckItem done={checks.shippingTimeline} label="Set your shipping timeline"                    href="/account#shipping-days"     hint="Let buyers know how quickly you ship" />
            <CheckItem done={checks.returnPolicy}     label="Set your return policy"                        href="/account#return-policy"     hint="Let buyers know upfront whether you accept returns" />
            <CheckItem done={checks.inventory}        label="Add your first item to inventory"              href="/dashboard/inventory"       hint="Everything starts in inventory — add your first plant here" />
            <CheckItem done={checks.listing}          label="Create your first listing or auction"          href="/dashboard/inventory"       hint="From inventory, list a plant at a fixed price or start a timed auction" />
            <CheckItem
              done={checks.storefront}
              label="Preview your storefront"
              href={profile?.username ? `/sellers/${profile.username}` : "/account"}
              hint="See how buyers discover and shop your store"
              external={!!profile?.username}
              doneHref={profile?.username ? `/sellers/${profile.username}` : undefined}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold">Seller Dashboard</h1>
            {profile?.groundbreaker && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                ⛏️ Groundbreaker {profile.groundbreaker_number ? `#${profile.groundbreaker_number}` : ""}
              </span>
            )}
          </div>
          {profile?.username && (
            <p className="text-muted-foreground text-sm mt-0.5">Welcome back, {profile.username}</p>
          )}
        </div>
        <Link href="/dashboard/create" className={cn(buttonVariants(), "bg-leaf hover:bg-forest gap-1")}>
          + Add Inventory
        </Link>
      </div>

      {showGroundbreakerBanner && <GroundbreakerBanner spotsLeft={spotsLeft} />}

      {/* Onboarding checklist */}
      {!allDone && (
        <Card className="border-[#C5D4BC] bg-[#EBF0E6]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-forest">Get your shop ready</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <CheckItem done={checks.profile}       label="Complete your profile"              href="/account"                    hint="Add a bio and profile photo so buyers trust you" />
            <CheckItem done={checks.stripe}        label="Connect your bank account"           href="/account#seller-payments"    hint="Required to receive payments — connect your bank via Stripe before listing" />
            <CheckItem done={checks.shipping}      label="Set up your ship-from address &amp; shipping preferences"  href="/account#shipping-settings"  hint="Required for calculated shipping rates and auto labels — also review your rate and label toggle settings" />
            <CheckItem done={checks.shippingTimeline} label="Set your shipping timeline"         href="/account#shipping-days"      hint="Let buyers know how quickly you ship so they know what to expect" />
            <CheckItem done={checks.returnPolicy}     label="Set your return policy"              href="/account#return-policy"      hint="Let buyers know upfront whether you accept returns, offer a DOA guarantee, or handle issues case by case" />
            <CheckItem done={checks.inventory}     label="Add your first item to inventory"    href="/dashboard/inventory"        hint="Everything starts in inventory — add your first plant here" />
            <CheckItem done={checks.listing}    label="Create your first listing or auction" href="/dashboard/inventory"  hint="From inventory, list a plant at a fixed price or start a timed auction" />
            <CheckItem
              done={checks.storefront}
              label="Preview your storefront"
              href={profile?.username ? `/sellers/${profile.username}` : "/account"}
              hint="See how buyers discover and shop your store — share the link when you're ready"
              external={!!profile?.username}
              doneHref={profile?.username ? `/sellers/${profile.username}` : undefined}
            />
            <CheckItem
              done={checks.garden}
              label="Share your garden on your storefront (optional)"
              href="/garden"
              hint="Add plants to My Garden and set it to public — visitors can browse your collection right from your storefront"
            />
          </CardContent>
        </Card>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Active Listings" value={listingCount ?? 0} href="/dashboard/listings" />
        <StatCard label="Live Auctions" value={auctionCount ?? 0} href="/dashboard/auctions" />
        <StatCard
          label="Orders to Ship"
          value={paidCount}
          highlight={paidCount > 0}
          href="/orders?tab=sales"
        />
        <StatCard
          label="This Month"
          value={centsToDisplay(thisMonthRevenue)}
          sub={`Platform only · All time: ${centsToDisplay(totalRevenue)}`}
          trend={revenueChangePct}
          href="/dashboard/analytics"
        />
        <StatCard label="Followers" value={followerCount ?? 0} href="/following?tab=followers" />
      </div>

      {/* Main content: recent orders + quick nav */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Recent orders */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Sales awaiting shipment</h2>
            <Link href="/orders?tab=sales" className="text-sm text-leaf hover:underline">View all</Link>
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
                      href="/orders?tab=sales"
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
            <NavLink href="/dashboard/inventory" label="My Stock" />
            <NavLink href="/dashboard/listings" label="Listings" />
            <NavLink href="/dashboard/auctions" label="My Auctions" />
            <NavLink href="/orders?tab=sales" label="My Sales" badge={paidCount > 0 ? paidCount : undefined} />
            <NavLink href="/dashboard/analytics" label="Analytics" />
            <NavLink href="/account" label="Account Settings" badge={!checks.stripe ? "!" : undefined} badgeColor="orange" />
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, sub, trend, href }: { label: string; value: number | string; highlight?: boolean; sub?: string; trend?: number | null; href?: string }) {
  const card = (
    <Card className={cn(highlight ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800" : "", href && "hover:bg-muted/40 transition-colors cursor-pointer")}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-3xl font-bold", highlight && "text-blue-700")}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {trend != null && (
          <p className={cn("text-xs font-semibold flex items-center gap-0.5 mt-1.5", trend >= 0 ? "text-leaf" : "text-red-600")}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend >= 0 ? "+" : ""}{trend}% vs last month
          </p>
        )}
      </CardContent>
    </Card>
  );
  if (href) return <Link href={href}>{card}</Link>;
  return card;
}

function CheckItem({ done, label, href, hint, external, doneHref }: {
  done: boolean; label: string; href: string; hint: string;
  external?: boolean; doneHref?: string;
}) {
  const linkTarget = external ? "_blank" : undefined;
  const linkRel    = external ? "noopener noreferrer" : undefined;

  const content = (
    <div className="flex items-start gap-3">
      <div className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold", done ? "bg-leaf text-white" : "border-2 border-sage text-leaf")}>
        {done ? "✓" : ""}
      </div>
      <div>
        <p className={cn("text-sm font-medium", done ? "text-forest line-through opacity-60" : "text-forest")}>{label}</p>
        {!done && <p className="text-xs text-forest/70 mt-0.5">{hint}</p>}
      </div>
    </div>
  );

  if (done && doneHref) {
    return <Link href={doneHref} target={linkTarget} rel={linkRel} className="block rounded-lg hover:bg-black/5 transition-colors -mx-2 px-2 py-1">{content}</Link>;
  }
  if (done) return <div className="py-1">{content}</div>;
  return (
    <Link href={href} target={linkTarget} rel={linkRel} className="block rounded-lg hover:bg-black/5 transition-colors -mx-2 px-2 py-1">
      {content}
    </Link>
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
          badgeColor === "green"  ? "bg-[#DFE7D4] text-leaf" :
          "bg-blue-100 text-blue-700"
        )}>
          {badge}
        </span>
      )}
    </Link>
  );
}
