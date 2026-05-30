export const dynamic = "force-dynamic";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import PricingClient from "./pricing-client";

const GROUNDBREAKER_LIMIT = 150;

export default async function PricingPage() {
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
