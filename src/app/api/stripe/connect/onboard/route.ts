import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id, stripe_onboarded")
    .eq("id", user.id)
    .single();

  let accountId = profile?.stripe_account_id;

  try {
    if (!accountId) {
      const account = await getStripe().accounts.create({ type: "express" });
      accountId = account.id;
      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
    const accountLink = await getStripe().accountLinks.create({
      account: accountId,
      refresh_url: `${appUrl}/api/stripe/connect/callback`,
      return_url: `${appUrl}/api/stripe/connect/callback`,
      type: "account_onboarding",
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
