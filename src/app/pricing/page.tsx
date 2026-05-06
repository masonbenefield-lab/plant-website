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
      listings: "10 active listings",
      photos: "5 photos per listing",
      auctions: "5 active auctions",
      commission: "6.5% platform commission",
      banner: false,
      search: false,
      analytics: "Basic stats",
      bulk: false,
      support: "Standard support",
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
      listings: "50 active listings",
      photos: "10 photos per listing",
      auctions: "Unlimited auctions",
      commission: "4.5% platform commission",
      banner: true,
      search: true,
      analytics: "Basic analytics",
      bulk: "Basic bulk tools",
      support: "Standard support",
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
      photos: "Unlimited photos",
      auctions: "Unlimited auctions",
      commission: "3% platform commission",
      banner: true,
      search: true,
      analytics: "Full sales analytics",
      bulk: "Advanced bulk tools",
      support: "Priority support",
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
  { label: "Support",                     key: "support" },
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
                          {isString ? val : row.label}
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
      <section className="px-4 pb-16">
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

      {/* Digest callout */}
      <section className="px-4 pb-16">
        <div className="max-w-2xl mx-auto bg-muted rounded-2xl border p-8">
          <p className="text-2xl mb-3 text-center">📬</p>
          <h2 className="font-bold text-lg mb-2 text-center">The weekly buyer digest</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6 text-center">
            Every week, Plantet sends a curated email to all opted-in buyers featuring new plant listings, hot auctions, and picks from shops they follow. Paid plans get their listings in front of real buyers automatically.
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3 rounded-xl bg-background border p-4">
              <span className="text-lg mt-0.5">🌱</span>
              <div>
                <p className="text-sm font-semibold">Seedling — not included</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Seedling listings are not featured in the digest. Upgrade to a paid plan to get discovered by buyers who've never visited your storefront.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-background border p-4">
              <span className="text-lg mt-0.5">🌿</span>
              <div>
                <p className="text-sm font-semibold">Grower — Fresh Picks</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Your newest listings are eligible for the "Fresh Picks" section shown to every subscriber. Up to 6 sellers are featured per digest (1 listing each), rotating weekly so exposure is spread across the community.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <span className="text-lg mt-0.5">🌳</span>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Nursery — Fresh Picks + Follower Highlights</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">Eligible for Fresh Picks <em>and</em> featured in a personalized "From shops you follow" section sent directly to every buyer who follows your store. One listing per digest, delivered to your most engaged audience.</p>
              </div>
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
    q: "What happens if I exceed my listing limit?",
    a: "You'll be prompted to upgrade before publishing a new listing. Your existing listings stay active — nothing gets removed.",
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
    a: "Every Sunday, Plantet sends a curated email to opted-in buyers. Up to 6 Grower+ sellers are featured in the 'Fresh Picks' section (1 listing each), rotating weekly so exposure is spread across the community. Nursery sellers are also eligible for a personalized 'From shops you follow' section sent to buyers who follow their store. Seedling sellers are not included.",
  },
];
