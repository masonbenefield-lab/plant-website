"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Seedling",
    badge: null,
    monthlyPrice: 0,
    yearlyPrice: 0,
    description: "Perfect for casual sellers and hobbyists getting started.",
    cta: "Get started free",
    ctaHref: "/signup",
    ctaStyle: "outline" as const,
    commissionRate: 6.5,
    features: {
      inventory: "Free inventory management",
      listings: "Unlimited listings",
      photos: "5 photos per listing",
      auctions: "5 active auctions",
      commission: "6.5% platform commission",
      banner: false,
      search: false,
      analytics: "Basic stats",
      bulk: false,
      support: "Email support",
      featured: false,
      digest: false,
    },
  },
  {
    name: "Grower",
    badge: "Most Popular",
    monthlyPrice: 9,
    yearlyPrice: 86,
    description: "For serious sellers ready to grow their plant business.",
    cta: "Start Grower",
    ctaHref: "/signup?plan=grower",
    ctaStyle: "default" as const,
    commissionRate: 4.5,
    features: {
      inventory: "Free inventory management",
      listings: "Unlimited listings",
      photos: "10 photos per listing",
      auctions: "Unlimited auctions",
      commission: "4.5% platform commission",
      banner: true,
      search: true,
      analytics: "Basic analytics",
      bulk: "Basic bulk tools",
      support: "Email support",
      featured: false,
      digest: "Eligible for weekly buyer digest",
    },
  },
  {
    name: "Nursery",
    badge: null,
    monthlyPrice: 29,
    yearlyPrice: 278,
    description: "Built for high-volume sellers and professional nurseries.",
    cta: "Start Nursery",
    ctaHref: "/signup?plan=nursery",
    ctaStyle: "default" as const,
    commissionRate: 3,
    features: {
      inventory: "Free inventory management",
      listings: "Unlimited listings",
      photos: "Up to 20 photos per listing",
      auctions: "Unlimited auctions",
      commission: "3% platform commission",
      banner: true,
      search: true,
      analytics: "Full sales analytics",
      bulk: "Advanced bulk tools",
      support: "Priority email support",
      featured: true,
      digest: "Eligible for digest + follower highlights",
    },
  },
];

const comparisonRows = [
  { label: "Inventory management",        key: "inventory" },
  { label: "Active listings",             key: "listings" },
  { label: "Photos per listing",          key: "photos" },
  { label: "Active auctions",             key: "auctions" },
  { label: "Platform commission",         key: "commission" },
  { label: "Custom storefront banner",    key: "banner" },
  { label: "Priority search placement",   key: "search" },
  { label: "Sales analytics",             key: "analytics" },
  { label: "Bulk listing tools",          key: "bulk" },
  { label: "Email support",                key: "support" },
  { label: "Featured homepage placement", key: "featured" },
  { label: "Weekly buyer digest",          key: "digest" },
];

function BreakevenCalculator() {
  const [monthlySales, setMonthlySales] = useState(500);

  const seedlingCost  = monthlySales * 0.065;
  const growerCost    = monthlySales * 0.045 + 9;
  const nurseryCost   = monthlySales * 0.03  + 29;

  const growerBreakeven  = Math.ceil(9  / (0.065 - 0.045));  // $450
  const nurseryBreakeven = Math.ceil(20 / (0.045 - 0.03));   // ~$1,334 above Grower

  const bestPlan =
    nurseryCost < growerCost && nurseryCost < seedlingCost ? "Nursery"
    : growerCost < seedlingCost ? "Grower"
    : "Seedling";

  const bestColor =
    bestPlan === "Nursery" ? "text-blue-600" :
    bestPlan === "Grower"  ? "text-green-700" :
    "text-muted-foreground";

  return (
    <section className="px-4 pb-16">
      <div className="max-w-2xl mx-auto bg-muted rounded-2xl border p-8">
        <h2 className="font-bold text-xl mb-1 text-center">Find your breakeven</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Drag the slider to your estimated monthly sales and see which plan saves you the most.
        </p>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Monthly sales</span>
            <span className="font-bold text-lg">${monthlySales.toLocaleString()}</span>
          </div>
          <input
            type="range"
            min={0}
            max={5000}
            step={50}
            value={monthlySales}
            onChange={(e) => setMonthlySales(Number(e.target.value))}
            className="w-full accent-green-700"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>$0</span>
            <span>$5,000</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { name: "Seedling", cost: seedlingCost,  sub: 0  },
            { name: "Grower",   cost: growerCost,    sub: 9  },
            { name: "Nursery",  cost: nurseryCost,   sub: 29 },
          ].map((t) => (
            <div
              key={t.name}
              className={cn(
                "rounded-xl border p-4 text-center transition-all",
                bestPlan === t.name
                  ? "border-green-500 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500"
                  : "bg-card"
              )}
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{t.name}</p>
              <p className="text-xl font-bold">${t.cost.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.sub > 0 ? `$${t.sub}/mo + ` : ""}{t.name === "Seedling" ? "6.5" : t.name === "Grower" ? "4.5" : "3"}% commission
              </p>
              {bestPlan === t.name && (
                <span className="inline-block mt-2 text-xs font-semibold text-green-700 dark:text-green-400">Best value</span>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-lg bg-background border px-5 py-4 text-sm space-y-1.5 text-muted-foreground">
          <p>
            Upgrading to <strong className="text-foreground">Grower</strong> pays for itself at{" "}
            <strong className="text-green-700">${growerBreakeven.toLocaleString()}/mo</strong> in sales.
          </p>
          <p>
            Upgrading to <strong className="text-foreground">Nursery</strong> (from Grower) pays for itself at{" "}
            <strong className="text-green-700">${(growerBreakeven + nurseryBreakeven).toLocaleString()}/mo</strong> in sales.
          </p>
          {monthlySales > 0 && (
            <p className="pt-1 border-t">
              At <strong className="text-foreground">${monthlySales.toLocaleString()}/mo</strong>, the{" "}
              <strong className={bestColor}>{bestPlan}</strong> plan costs you the least overall.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StorefrontBannerSection() {
  return (
    <section id="storefront-banner" className="px-4 pb-16">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-2xl mb-3">🎨</p>
          <h2 className="font-bold text-2xl mb-3">Custom storefront banner</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Your storefront is your brand. A custom banner turns a plain shop page into something buyers remember — whether you&apos;re a casual hobbyist or a professional nursery.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
          {/* Without banner */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 text-center">Seedling — no banner</p>
            <div className="rounded-2xl border overflow-hidden bg-card shadow-sm">
              <div className="h-24 bg-muted flex items-end px-4 pb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-muted-foreground/20 border-2 border-background shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">leafy_greens</p>
                    <p className="text-xs text-muted-foreground">12 listings</p>
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square bg-muted rounded-lg" />
                ))}
              </div>
            </div>
          </div>

          {/* With banner */}
          <div>
            <p className="text-xs font-semibold text-green-700 uppercase tracking-widest mb-3 text-center">Grower &amp; Nursery — with banner</p>
            <div className="rounded-2xl border overflow-hidden bg-card shadow-sm ring-2 ring-green-500">
              <div
                className="h-24 relative flex items-end px-4 pb-3"
                style={{ background: "linear-gradient(135deg, #052e16 0%, #14532d 35%, #166534 65%, #15803d 100%)" }}
              >
                <div
                  className="absolute inset-0 opacity-25"
                  style={{ backgroundImage: "radial-gradient(ellipse at 75% 40%, rgba(134,239,172,0.4) 0%, transparent 55%)" }}
                />
                <div className="relative flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-green-800/60 border-2 border-white/20 shrink-0 flex items-center justify-center text-lg">
                    🌿
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-white">leafy_greens</p>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs text-green-300">12 listings</p>
                      <span className="text-green-500 text-xs">·</span>
                      <p className="text-xs text-green-300">⭐ 4.9</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-4 grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="aspect-square bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-800/40" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const SEARCH_LISTINGS = [
  { name: "Monstera Deliciosa", price: "$28", seller: "leafy_greens", priority: true },
  { name: "Fiddle Leaf Fig",    price: "$45", seller: "plantparent",  priority: true },
  { name: "Pothos Golden",      price: "$12", seller: "urban_jungle",  priority: true },
  { name: "Snake Plant",        price: "$18", seller: "hobbyist99",   priority: false },
  { name: "Peace Lily",         price: "$22", seller: "plant_noob",   priority: false },
  { name: "ZZ Plant",           price: "$35", seller: "freebie_shop", priority: false },
];

function SearchPlacementSection() {
  const priority = SEARCH_LISTINGS.filter((l) => l.priority);
  const standard = SEARCH_LISTINGS.filter((l) => !l.priority);

  return (
    <section id="search-placement" className="px-4 pb-16">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-2xl mb-3">🔍</p>
          <h2 className="font-bold text-2xl mb-3">Priority search placement</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            When buyers search for plants, paid sellers rise to the top automatically. No bidding, no ad spend — just plan-based placement so your listings get seen first.
          </p>
        </div>

        <div className="rounded-2xl border bg-card p-5">
          {/* Mock search bar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5 text-sm text-muted-foreground">
              <span className="opacity-50">🔍</span>
              <span>monstera</span>
            </div>
            <div className="bg-green-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium select-none">Search</div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">6 results for &quot;monstera&quot;</p>

          {/* Priority listings */}
          <div className="grid grid-cols-3 gap-3 mb-2">
            {priority.map((listing) => (
              <div key={listing.name} className="rounded-xl border overflow-hidden bg-background ring-1 ring-green-500/30">
                <div className="aspect-square relative bg-green-50 dark:bg-green-900/20">
                  <span className="absolute top-1.5 left-1.5 bg-green-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                    ⚡ Priority
                  </span>
                </div>
                <div className="p-2">
                  <p className="text-[11px] font-medium leading-tight truncate">{listing.name}</p>
                  <p className="text-[10px] text-green-700 dark:text-green-400 font-semibold mt-0.5">{listing.price}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{listing.seller}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-2 my-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted-foreground px-1">Seedling listings</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Standard listings */}
          <div className="grid grid-cols-3 gap-3 opacity-50">
            {standard.map((listing) => (
              <div key={listing.name} className="rounded-xl border overflow-hidden bg-background">
                <div className="aspect-square bg-muted" />
                <div className="p-2">
                  <p className="text-[11px] font-medium leading-tight truncate">{listing.name}</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-0.5">{listing.price}</p>
                  <p className="text-[9px] text-muted-foreground truncate">{listing.seller}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-muted-foreground text-center mt-4">
            Grower &amp; Nursery listings always appear above Seedling listings in search results
          </p>
        </div>
      </div>
    </section>
  );
}

const CHART_DATA = [
  { month: "Dec", value: 340 },
  { month: "Jan", value: 520 },
  { month: "Feb", value: 390 },
  { month: "Mar", value: 680 },
  { month: "Apr", value: 890 },
  { month: "May", value: 750 },
];

const TOP_ITEMS = [
  { name: "Monstera Deliciosa", sold: 14, revenue: "$392" },
  { name: "Fiddle Leaf Fig",    sold: 9,  revenue: "$405" },
  { name: "Pothos Golden",      sold: 23, revenue: "$276" },
];

const PLAN_TIERS = [
  {
    name: "Seedling",
    color: "bg-muted",
    border: "border",
    items: ["Revenue this month", "Order count", "Avg order value"],
  },
  {
    name: "Grower",
    color: "bg-blue-50 dark:bg-blue-900/20",
    border: "border border-blue-200 dark:border-blue-800",
    items: ["Everything in Seedling", "6-month revenue chart", "Top 5 best sellers"],
  },
  {
    name: "Nursery",
    color: "bg-green-50 dark:bg-green-900/20",
    border: "border border-green-200 dark:border-green-800",
    items: ["Everything in Grower", "Repeat buyer rate", "Follower growth chart", "Buyer geography map"],
  },
];

function AnalyticsDashboardSection() {
  const max = Math.max(...CHART_DATA.map((d) => d.value));

  return (
    <section id="analytics-preview" className="px-4 pb-16">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-2xl mb-3">📊</p>
          <h2 className="font-bold text-2xl mb-3">Full sales analytics</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
            Know exactly what&apos;s selling, who&apos;s buying, and where your revenue is coming from. Each plan unlocks a deeper view of your business.
          </p>
        </div>

        {/* Plan tier breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {PLAN_TIERS.map((tier) => (
            <div key={tier.name} className={cn("rounded-xl p-4", tier.color, tier.border)}>
              <p className="font-semibold text-xs uppercase tracking-wide mb-2 text-muted-foreground">{tier.name}</p>
              <ul className="space-y-1.5">
                {tier.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5 text-xs">
                    <Check size={11} className="mt-0.5 text-green-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Dashboard mockup */}
        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-sm font-semibold">Dashboard preview</p>
            <span className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-2.5 py-1 rounded-full font-medium">
              Nursery plan
            </span>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: "Revenue this month", value: "$1,247", sub: "↑ 18% vs last month" },
              { label: "Orders",             value: "23",     sub: "This month" },
              { label: "Avg order value",    value: "$54.22", sub: "All time" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-muted/60 p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
                <p className="text-[10px] text-green-700 dark:text-green-400 mt-0.5">{stat.sub}</p>
              </div>
            ))}
          </div>

          {/* Bar chart */}
          <div className="mb-5">
            <p className="text-xs font-medium text-muted-foreground mb-3">Revenue — last 6 months</p>
            <div className="flex items-end gap-2 h-24 pb-5 relative">
              {CHART_DATA.map(({ month, value }) => (
                <div key={month} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <div
                    className="w-full rounded-t-md bg-green-600 transition-all"
                    style={{ height: `${Math.round((value / max) * 72)}px` }}
                  />
                  <span className="text-[9px] text-muted-foreground shrink-0">{month}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top performers */}
          <div className="mb-4">
            <p className="text-xs font-medium text-muted-foreground mb-2">Top performers</p>
            <div className="space-y-1.5">
              {TOP_ITEMS.map((item, i) => (
                <div key={item.name} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">{i + 1}</span>
                    <span className="text-xs font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-muted-foreground">{item.sold} sold</span>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">{item.revenue}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Nursery extras */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Repeat buyer rate</p>
              <p className="text-xl font-bold">38%</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">of buyers have ordered 2+ times</p>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Top shipping states</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {["TX", "CA", "FL", "NY", "WA"].map((s) => (
                  <span key={s} className="text-[9px] font-bold bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  return (
    <div className="flex flex-col">

      {/* Header */}
      <section className="py-16 sm:py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, transparent pricing</h1>
          <p className="text-muted-foreground text-lg mb-8">
            Start free. Upgrade when you&apos;re ready. No hidden fees — just a commission when you sell.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 bg-muted rounded-full px-2 py-1.5">
            <button
              onClick={() => setAnnual(false)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                !annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                annual ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Annual
              <span className="ml-2 text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full font-semibold">
                Save 20%
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Groundbreaker callout */}
      <section className="px-4 pb-10">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="text-4xl shrink-0">⛏️</div>
            <div className="flex-1">
              <p className="font-bold text-lg text-amber-900 dark:text-amber-200 mb-1">
                Groundbreaker — 150 spots, first come first served
              </p>
              <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
                The first 150 sellers to join Plantet get the <strong>Nursery plan free forever</strong> plus a permanent{" "}
                <strong>2% commission rate</strong> — lower than any paid tier. Sign up today to lock in your spot before they&apos;re gone.
              </p>
            </div>
            <a
              href="/signup"
              className="shrink-0 inline-flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm px-5 py-2.5 transition-colors whitespace-nowrap"
            >
              Claim your spot
            </a>
          </div>
        </div>
      </section>

      {/* Pricing cards */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier) => {
            const price = annual ? tier.yearlyPrice : tier.monthlyPrice;
            const isPopular = !!tier.badge;

            return (
              <div
                key={tier.name}
                className={cn(
                  "relative flex flex-col rounded-2xl border p-8",
                  isPopular
                    ? "border-green-500 bg-green-700 text-white shadow-xl shadow-green-900/20 scale-[1.02]"
                    : "bg-card"
                )}
              >
                {tier.badge && (
                  <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-green-400 text-green-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                    {tier.badge}
                  </span>
                )}

                <div className="mb-6">
                  <p className={cn("text-xs font-bold uppercase tracking-widest mb-2", isPopular ? "text-green-200" : "text-muted-foreground")}>
                    {tier.name}
                  </p>
                  <div className="flex items-end gap-1 mb-2">
                    {price === 0 ? (
                      <span className="text-5xl font-bold">Free</span>
                    ) : (
                      <>
                        <span className="text-5xl font-bold">${price}</span>
                        <span className={cn("text-sm mb-2", isPopular ? "text-green-200" : "text-muted-foreground")}>
                          /{annual ? "yr" : "mo"}
                        </span>
                      </>
                    )}
                  </div>
                  {annual && price > 0 && (
                    <p className={cn("text-xs", isPopular ? "text-green-200" : "text-muted-foreground")}>
                      ${(price / 12).toFixed(2)}/mo billed annually
                    </p>
                  )}
                  <p className={cn("text-sm mt-3 leading-relaxed", isPopular ? "text-green-100" : "text-muted-foreground")}>
                    {tier.description}
                  </p>
                </div>

                <ul className="space-y-3 flex-1 mb-8">
                  {comparisonRows.map((row) => {
                    const val = tier.features[row.key as keyof typeof tier.features];
                    const isString = typeof val === "string";
                    const isFalse = val === false;

                    return (
                      <li key={row.key} className="flex items-start gap-2.5 text-sm">
                        {isFalse ? (
                          <Minus size={16} className={cn("mt-0.5 shrink-0", isPopular ? "text-green-400" : "text-muted-foreground/40")} />
                        ) : (
                          <Check size={16} className={cn("mt-0.5 shrink-0", isPopular ? "text-green-300" : "text-green-600")} />
                        )}
                        <span className={cn(isFalse && !isPopular && "text-muted-foreground/60", isFalse && isPopular && "text-green-300/60")}>
                          {row.key === "digest" ? (
                            <a href="#weekly-digest" className={cn("underline underline-offset-2 decoration-dotted hover:opacity-80", isPopular ? "text-white" : "")}>
                              {isString ? val : row.label}
                            </a>
                          ) : row.key === "commission" && isString ? (
                            <a href="#commission" className={cn("underline underline-offset-2 decoration-dotted hover:opacity-80", isPopular ? "text-white" : "")}>
                              {val}
                            </a>
                          ) : row.key === "banner" && !isFalse ? (
                            <a href="#storefront-banner" className={cn("underline underline-offset-2 decoration-dotted hover:opacity-80", isPopular ? "text-white" : "")}>
                              {row.label}
                            </a>
                          ) : row.key === "search" && !isFalse ? (
                            <a href="#search-placement" className={cn("underline underline-offset-2 decoration-dotted hover:opacity-80", isPopular ? "text-white" : "")}>
                              {row.label}
                            </a>
                          ) : row.key === "analytics" && isString ? (
                            <a href="#analytics-preview" className={cn("underline underline-offset-2 decoration-dotted hover:opacity-80", isPopular ? "text-white" : "")}>
                              {val}
                            </a>
                          ) : isString ? val : row.label}
                        </span>
                      </li>
                    );
                  })}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={cn(
                    buttonVariants({ size: "lg" }),
                    "w-full justify-center font-semibold",
                    isPopular
                      ? "bg-white text-green-800 hover:bg-green-50"
                      : tier.ctaStyle === "outline"
                      ? "bg-transparent border border-border hover:bg-muted"
                      : "bg-green-700 hover:bg-green-800 text-white"
                  )}
                >
                  {tier.cta}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      {/* Breakeven calculator */}
      <BreakevenCalculator />

      {/* Commission callout */}
      <section id="commission" className="px-4 pb-16">
        <div className="max-w-2xl mx-auto bg-muted rounded-2xl border p-8 text-center">
          <p className="text-2xl mb-3">💳</p>
          <h2 className="font-bold text-lg mb-2">How commissions work</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            A commission is only charged when you make a sale — never on listings. It&apos;s automatically deducted from the payment before it hits your bank account via Stripe, so you never have to think about it.
          </p>
          <div className="text-left bg-background rounded-xl border p-4 text-sm space-y-2">
            <p className="font-semibold text-foreground mb-1">Example: $25 sale on Seedling plan</p>
            <div className="flex justify-between text-muted-foreground"><span>Sale price</span><span>$25.00</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Stripe processing fee (2.9% + $0.30)</span><span>− $1.03</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Plantet commission (6.5%)</span><span>− $1.63</span></div>
            <div className="flex justify-between font-semibold text-foreground border-t pt-2"><span>You receive</span><span>$22.34</span></div>
          </div>
        </div>
      </section>

      {/* Storefront banner callout */}
      <StorefrontBannerSection />

      {/* Search placement callout */}
      <SearchPlacementSection />

      {/* Analytics preview callout */}
      <AnalyticsDashboardSection />

      {/* Digest callout */}
      <section id="weekly-digest" className="px-4 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-2xl mb-3">📬</p>
            <h2 className="font-bold text-2xl mb-3">The weekly buyer digest</h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
              Every Sunday, Plantet sends a curated email to opted-in buyers with fresh listings, hot auctions, and picks from shops they follow. Paid plans get in front of real buyers automatically — no ad spend needed.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-10 items-start justify-center">
            {/* Tier breakdown */}
            <div className="flex-1 max-w-lg space-y-3">
              <div className="flex items-start gap-3 rounded-xl bg-muted border p-4">
                <span className="text-lg mt-0.5">🌱</span>
                <div>
                  <p className="text-sm font-semibold">Seedling — not included</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Seedling listings are not featured in the digest. Upgrade to a paid plan to get discovered by buyers who&apos;ve never visited your storefront.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-muted border p-4">
                <span className="text-lg mt-0.5">🌿</span>
                <div>
                  <p className="text-sm font-semibold">Grower — Fresh Picks</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Your newest listings are eligible for the &quot;Fresh Picks&quot; section shown to every subscriber. Up to 6 Grower+ sellers are featured per digest (1 listing each), rotating weekly.</p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
                <span className="text-lg mt-0.5">🌳</span>
                <div>
                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">Nursery — Fresh Picks + Follower Highlights</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Eligible for Fresh Picks <em>and</em> a personalized &quot;From shops you follow&quot; section sent to every buyer following your store. Up to 4 of your newest listings per digest, delivered straight to your most engaged audience.</p>
                </div>
              </div>
            </div>

            {/* Live email preview */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Live preview</p>
              <div
                className="relative rounded-2xl overflow-hidden shadow-2xl border bg-[#f0fdf4]"
                style={{ width: 300, height: 500 }}
              >
                <iframe
                  src="/api/digest-preview"
                  title="Weekly digest preview"
                  sandbox="allow-same-origin"
                  style={{
                    width: 600,
                    height: 1000,
                    transform: "scale(0.5)",
                    transformOrigin: "top left",
                    border: "none",
                    pointerEvents: "none",
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#f0fdf4] to-transparent pointer-events-none" />
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-[240px]">What your buyers see every Sunday in their inbox</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 pb-20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently asked questions</h2>
          <div className="space-y-6">
            {faqs.map((faq) => (
              <div key={faq.q} className="border-b pb-6 last:border-0">
                <p className="font-semibold mb-2">{faq.q}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}

const faqs = [
  {
    q: "Can I change plans at any time?",
    a: "Yes. You can upgrade or downgrade at any time. Upgrades take effect immediately; downgrades apply at the end of your current billing period.",
  },
  {
    q: "Are there limits on how many listings I can have?",
    a: "No — all plans including Seedling support unlimited listings. We make money when you sell, so there's no reason to cap your inventory. Auction limits still apply on the free Seedling plan (5 active auctions).",
  },
  {
    q: "Is the commission charged on top of the sale price?",
    a: "No. The commission is deducted from the payment you receive. If you sell a plant for $20 on the Seedling plan, you receive $17.82 after the 6.5% Plantet commission and Stripe's 2.9% + $0.30 processing fee.",
  },
  {
    q: "Do auction wins count toward my commission?",
    a: "Yes, auctions are subject to the same commission rate as fixed-price listings based on your current plan.",
  },
  {
    q: "What happens to fees if I issue a refund?",
    a: "If you refund a buyer, Plantet's commission is returned to you automatically. However, Stripe's processing fee (2.9% + $0.30) is non-refundable — Stripe keeps it regardless of refunds. This is standard across all payment platforms including Etsy and eBay. For this reason, we recommend clearly communicating your return policy to buyers before they purchase.",
  },
  {
    q: "What analytics do I get on each plan?",
    a: "All plans include basic stats: revenue this month, order count, average order value, and total all-time revenue. Grower adds a 6-month revenue chart and your top 5 best-performing items. Nursery adds a full per-item breakdown, category performance, and buyer geography.",
  },
  {
    q: "Is there a free trial on paid plans?",
    a: "We don't offer a time-limited trial, but the free Seedling plan lets you get started with no commitment. Upgrade when you're ready to unlock more.",
  },
  {
    q: "How does the weekly buyer digest work?",
    a: "Every Sunday, Plantet sends a curated email to opted-in buyers. Up to 6 Grower+ sellers are featured in the 'Fresh Picks' section (1 listing each), rotating weekly so exposure is spread across the community. Nursery sellers are also eligible for a personalized 'From shops you follow' section — buyers who follow your store see up to 4 of your newest listings that week. Seedling sellers are not included.",
  },
];
