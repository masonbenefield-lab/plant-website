import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_account_id")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_account_id) {
    const account = await getStripe().accounts.retrieve(profile.stripe_account_id);
    if (account.details_submitted) {
      await supabase
        .from("profiles")
        .update({ stripe_onboarded: true })
        .eq("id", user.id);
    }
  }

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/account`);
}
