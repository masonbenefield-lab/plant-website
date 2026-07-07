"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const GROUNDBREAKER_LIMIT = 150;

const includedFeatures = [
  "Unlimited listings",
  "Unlimited auctions",
  "Up to 8 photos per listing",
  "Custom storefront banner",
  "Full sales analytics",
  "Bulk listing tools",
  "Weekly buyer digest exposure",
  "Your own public storefront & reviews",
];

function GroundbreakerCallout({ spotsLeft }: { spotsLeft: number }) {
  return (
    <section className="px-4 pb-4">
      <div className="max-w-3xl mx-auto">
        <div className="rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="text-4xl shrink-0">⛏️</div>
          <div className="flex-1">
            <p className="font-bold text-lg text-amber-900 dark:text-amber-200 mb-1">
              Groundbreaker — {spotsLeft} of {GROUNDBREAKER_LIMIT} spots left
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              The first {GROUNDBREAKER_LIMIT} sellers lock in a permanent{" "}
              <strong>2% commission</strong> — well below the standard 5.5% — for life. Every feature
              included, no monthly fee, the rate never expires.
            </p>
          </div>
          <a
            href="/signup"
            className="shrink-0 inline-flex items-center justify-center rounded-xl bg-terra hover:bg-[#B05A39] text-white font-semibold text-sm px-5 py-2.5 transition-colors whitespace-nowrap"
          >
            Claim your spot
          </a>
        </div>
      </div>
    </section>
  );
}

export default function PricingClient({
  spotsLeft,
}: {
  groundbreakerCount: number;
  spotsLeft: number;
  limitReached: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <section className="py-16 sm:py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Simple, honest pricing</h1>
          <p className="text-muted-foreground text-lg">
            One flat commission — only when you sell. No monthly fees, no tiers, and no paying to get
            seen. Every seller gets every feature.
          </p>
        </div>
      </section>

      {spotsLeft > 0 && <GroundbreakerCallout spotsLeft={spotsLeft} />}

      {/* The flat rate */}
      <section className="px-4 pb-12">
        <div className="max-w-md mx-auto rounded-2xl border-2 border-leaf bg-card p-8 text-center shadow-xl shadow-forest/10">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Every seller
          </p>
          <div className="flex items-end justify-center gap-1 mb-1">
            <span className="text-6xl font-bold">5.5%</span>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            commission per sale, plus Stripe&apos;s processing fee. That&apos;s the whole price.
          </p>
          <ul className="text-left space-y-2 mb-8">
            {["No monthly fee", "No listing fees", "No paying for priority or placement"].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-leaf" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "w-full justify-center font-semibold bg-leaf hover:bg-forest text-white")}
          >
            Start selling free
          </Link>
        </div>
      </section>

      {/* How commission works */}
      <section id="commission" className="px-4 pb-16">
        <div className="max-w-2xl mx-auto bg-muted rounded-2xl border p-8 text-center">
          <p className="text-2xl mb-3">💳</p>
          <h2 className="font-bold text-lg mb-2">How commission works</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Commission is only charged when you make a sale — never on listings. It&apos;s deducted
            automatically from the payment via Stripe before it reaches your bank, so you never have to
            think about it.
          </p>
          <div className="text-left bg-background rounded-xl border p-4 text-sm space-y-2">
            <p className="font-semibold text-foreground mb-1">Example: $25 sale</p>
            <div className="flex justify-between text-muted-foreground"><span>Sale price</span><span>$25.00</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Stripe processing fee (2.9% + $0.30)</span><span>− $1.03</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Plantet commission (5.5%)</span><span>− $1.38</span></div>
            <div className="flex justify-between font-semibold text-foreground border-t pt-2"><span>You receive</span><span>$22.59</span></div>
          </div>
        </div>
      </section>

      {/* Everything included */}
      <section className="px-4 pb-16">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">Everything&apos;s included — free</h2>
          <p className="text-muted-foreground text-sm mb-8 max-w-xl mx-auto">
            No premium tier to buy. Every tool we build is available to every seller from day one.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
            {includedFeatures.map((f) => (
              <div key={f} className="flex items-start gap-3 rounded-xl border bg-card px-4 py-3">
                <Check size={18} className="mt-0.5 shrink-0 text-leaf" />
                <span className="text-sm font-medium">{f}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* No pay-to-win */}
      <section className="px-4 pb-16">
        <div className="max-w-2xl mx-auto rounded-2xl border bg-[#EBF0E6] dark:bg-forest/20 p-8 text-center">
          <p className="text-2xl mb-3">⚖️</p>
          <h2 className="font-bold text-xl mb-2">No pay-to-win</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            On Plantet, no one can buy their way to the top. There&apos;s no featured placement, no
            promoted listings, no ad auctions. Every seller ranks the same way — by how fresh their
            listings are and how well they treat buyers. A brand-new hobbyist and a full nursery stand
            on exactly the same ground.
          </p>
        </div>
      </section>

      <FaqSection />
    </div>
  );
}

function FaqSection() {
  return (
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
  );
}

const faqs = [
  {
    q: "Are there any monthly fees or subscriptions?",
    a: "No. There are no plans or subscriptions. Every seller pays one flat 5.5% commission, and only when they make a sale.",
  },
  {
    q: "Are there limits on listings or auctions?",
    a: "No — unlimited listings and unlimited auctions for everyone, free. We make money when you sell, so there's no reason to cap your inventory.",
  },
  {
    q: "Is the commission charged on top of the sale price?",
    a: "No. It's deducted from the payment you receive. Sell a plant for $20 and you receive $18.02 after Plantet's 5.5% commission ($1.10) and Stripe's 2.9% + $0.30 processing fee ($0.88).",
  },
  {
    q: "Do auction wins count toward my commission?",
    a: "Yes — auction sales are charged the same flat 5.5% as fixed-price listings.",
  },
  {
    q: "What's the Groundbreaker rate?",
    a: "The first 150 sellers to join lock in a permanent 2% commission — well below the standard 5.5%. Spots are limited, and the rate never expires.",
  },
  {
    q: "Do I get analytics and seller tools?",
    a: "Yes. Every tool is free for all sellers: full sales analytics, bulk listing tools, a custom storefront banner, and weekly buyer-digest exposure. Nothing is locked behind a paywall.",
  },
  {
    q: "What happens to fees if I issue a refund?",
    a: "If you refund a buyer, Plantet's commission is returned to you automatically. However, Stripe's processing fee (2.9% + $0.30) is non-refundable — Stripe keeps it regardless of refunds. This is standard across all payment platforms including Etsy and eBay, so we recommend communicating your return policy clearly before buyers purchase.",
  },
  {
    q: "How does the weekly buyer digest work?",
    a: "Every Sunday, Plantet emails opted-in buyers a curated set of fresh listings and hot auctions. Every seller is eligible — placement rotates so exposure is shared across the community, never bought.",
  },
];
