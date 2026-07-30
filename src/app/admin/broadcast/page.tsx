import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BroadcastClient } from "./broadcast-client";

export const dynamic = "force-dynamic";

// Pre-filled with the July 2026 giveaway LAST-CALL reminder (ends 7/31 11:59pm CT).
// Editable before sending.
const FELCO_DRAFT = {
  subject: "Last day to win a pair of FELCO 2 pruners",
  heading: "The Giveaway Ends Tomorrow at 11:59pm CT",
  subheading: "Free to enter — this is the last call",
  bodyMarkdown: `Quick heads-up before it's gone — our **FELCO 2 pruner giveaway ends tomorrow at 11:59pm CT.**

These are the red-handled Swiss pruners gardeners have trusted since 1945 — the pair you keep for decades. Entering is free and takes about ten seconds: just sign in and hit the button below.

We draw one winner tomorrow night and ship the prize to their door.

It's real, by the way — you can see last month's winner right on the giveaway page. 🌿

Happy growing,
The Plantet Team

---

No purchase necessary. US, 18+. Not affiliated with FELCO or Meta.`,
  ctaLabel: "Enter to Win",
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
