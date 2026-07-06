export const dynamic = "force-dynamic";

import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Seller Plans & Pricing — Plantet",
  description: "Start selling plants for free on Plantet. Choose a plan that fits your needs — whether you're a hobbyist or a full nursery.",
  openGraph: {
    title: "Seller Plans & Pricing — Plantet",
    description: "Start selling plants for free on Plantet. Choose a plan that fits your needs — whether you're a hobbyist or a full nursery.",
  },
};

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import PricingClient from "./pricing-client";

const GROUNDBREAKER_LIMIT = 150;

// Temporary: seller pricing is hidden while we roll out the new pricing model
// (week of 2026-07-06). Also pauses new Groundbreaker signups intentionally.
// To restore the live pricing page, set this back to false.
const HIDE_PRICING: boolean = true;

function PricingUpdating() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="max-w-md mx-auto">
        <div className="text-5xl mb-6">🌱</div>
        <h1 className="text-3xl sm:text-4xl font-bold mb-4">Pricing is getting an update</h1>
        <p className="text-muted-foreground text-lg leading-relaxed mb-8">
          We&apos;re rolling out a simpler, better deal for sellers this week. Check back
          soon — and in the meantime you can keep selling exactly as you do today.
        </p>
        <a
          href="/shop"
          className="inline-flex items-center justify-center rounded-xl bg-leaf hover:bg-forest text-white font-semibold px-6 py-3 transition-colors"
        >
          Browse the shop →
        </a>
      </div>
    </div>
  );
}

export default async function PricingPage() {
  if (HIDE_PRICING) {
    return <PricingUpdating />;
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("groundbreaker", true);

  const groundbreakerCount = count ?? 0;
  const spotsLeft = Math.max(0, GROUNDBREAKER_LIMIT - groundbreakerCount);

  return (
    <PricingClient
      groundbreakerCount={groundbreakerCount}
      spotsLeft={spotsLeft}
      limitReached={spotsLeft === 0}
    />
  );
}
