import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BroadcastClient } from "./broadcast-client";

export const dynamic = "force-dynamic";

// Pre-filled with the July 2026 giveaway announcement. Editable before sending.
const FELCO_DRAFT = {
  subject: "🎉 We have a winner! Plus July's giveaway is live — Felco Pruners",
  heading: "We Have a Winner!",
  subheading: "Congrats to our Cravens Craving Fig winner",
  bodyMarkdown: `Our **Cravens Craving Fig tree** giveaway officially closed, and we're thrilled to announce the winner:

## 🌿 Congratulations, @Mozart007!

Thank you to everyone who entered. We loved watching this community grow (pun fully intended 🌱).

## July's Giveaway Is Live 🎁

Didn't win this time? Your next chance is already here.

### This month's prize: Felco Pruners (FELCO 2)

The gold standard in hand pruners — Swiss-made, forged aluminum handles, hardened steel blade, and clean cuts up to 1 inch. Trusted by pros and home gardeners since 1945.

**Entries close July 31, 2026.** Entries reset each month, so you'll need to **enter again** to be eligible — last month's entries don't carry over.`,
  ctaLabel: "Enter the July Giveaway",
  ctaUrl: "https://www.plantet.shop/giveaway",
  includeReferralBlock: true,
};

export default async function BroadcastPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) redirect("/");

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { count } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("email_marketing_opt_in", true)
    .is("deleted_at", null);

  return (
    <BroadcastClient
      initial={FELCO_DRAFT}
      optedInCount={count ?? 0}
      adminEmail={user.email ?? ""}
    />
  );
}
