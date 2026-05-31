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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  async function createAccountLink(id: string) {
    return getStripe().accountLinks.create({
      account: id,
      refresh_url: `${appUrl}/api/stripe/connect/callback`,
      return_url: `${appUrl}/api/stripe/connect/callback`,
      type: "account_onboarding",
    });
  }

  try {
    if (!accountId) {
      const account = await getStripe().accounts.create({ type: "express" });
      accountId = account.id;
      await supabase.from("profiles").update({ stripe_account_id: accountId, stripe_onboarded: false }).eq("id", user.id);
    }

    let accountLink;
    try {
      accountLink = await createAccountLink(accountId);
    } catch (linkErr) {
      // Existing account not found in this Stripe mode (e.g. live account ID used with test keys).
      // Create a fresh account and try again.
      const isNotFound = linkErr instanceof Error && linkErr.message.includes("not connected to your platform");
      if (!isNotFound) throw linkErr;
      const account = await getStripe().accounts.create({ type: "express" });
      accountId = account.id;
      await supabase.from("profiles").update({ stripe_account_id: accountId, stripe_onboarded: false }).eq("id", user.id);
      accountLink = await createAccountLink(accountId);
    }

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
