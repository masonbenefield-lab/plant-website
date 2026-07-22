import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { BroadcastClient } from "./broadcast-client";

export const dynamic = "force-dynamic";

// Pre-filled with the July 2026 giveaway deadline reminder + native app launch.
// Editable before sending.
const FELCO_DRAFT = {
  subject: "9 days left to win a pair of FELCO 2 pruners",
  heading: "The July Giveaway Closes July 31",
  subheading: "Only 8 people have entered so far",
  bodyMarkdown: `Quick heads up — our **July giveaway closes Friday, July 31**, and so far only **8 people have entered**. Those are very good odds for a tool most gardeners keep for life.

### This month's prize: FELCO 2 Pruning Shears

The benchmark for hand pruners since 1945. Swiss-made, forged aluminum handles, hardened steel blade, clean cuts up to a full inch. We'll reach out to you directly before we buy and ship them.

Entering takes one click, and it's free.

---

### One more thing: Plantet is now an app

We're officially live on the **App Store** and **Google Play**. Same Plantet, quicker to open, plus push notifications so you never miss a bid, an order, or a watering reminder.

[Get the Plantet app](https://plantet.shop/app)

One link for both — it figures out your phone for you.

---

Thanks for being here early. It means a lot.

Happy growing,
The Plantet Team`,
  ctaLabel: "Enter the Giveaway",
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
