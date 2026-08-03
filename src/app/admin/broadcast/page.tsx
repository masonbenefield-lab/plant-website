import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BroadcastClient } from "./broadcast-client";

export const dynamic = "force-dynamic";

// Pre-filled with the August 2026 giveaway announcement (ends 8/31 11:59pm CT).
// Editable before sending.
const FELCO_DRAFT = {
  subject: "Win a Panache Tiger Fig Tree this month 🌿",
  heading: "This Month's Giveaway: A Panache Tiger Fig Tree",
  subheading: "Free to enter — closes August 31st",
  bodyMarkdown: `Our August giveaway is live, and it's a beauty — a **Panache Tiger Fig Tree**, yours to grow.

Nicknamed the "Tiger" fig for its green-and-yellow striped fruit, Panache is prized for a sweet, honeyed, berry-like flavor that's hard to find anywhere but your own backyard. It's the kind of tree you plant once and enjoy for years.

Entering is free and takes about ten seconds: just sign in and hit the button below. **The giveaway closes August 31st at 11:59pm CT**, and we'll draw one winner and ship the tree right to their door.

It's real, by the way — you can see our past winners right on the giveaway page. 🌿

Happy growing,
The Plantet Team

---

No purchase necessary. US, 18+.`,
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
