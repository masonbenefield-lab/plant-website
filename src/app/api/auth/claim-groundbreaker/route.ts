import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";

function generateReferralCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("groundbreaker, username, referral_code")
    .eq("id", user.id)
    .single();

  if (profile?.groundbreaker) return NextResponse.json({ ok: true, already: true });

  // Generate a unique referral code for this user
  let referralCode = profile?.referral_code;
  if (!referralCode) {
    let attempts = 0;
    while (attempts < 5) {
      const candidate = generateReferralCode();
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("referral_code", candidate)
        .maybeSingle();
      if (!existing) { referralCode = candidate; break; }
      attempts++;
    }
  }

  // Wire up referrer if signup included a ref code
  let referredBy: string | null = null;
  const refCode = user.user_metadata?.referral_code as string | undefined;
  if (refCode) {
    const { data: referrer } = await admin
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode)
      .maybeSingle();
    if (referrer && referrer.id !== user.id) referredBy = referrer.id;
  }

  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("groundbreaker", true);

  const profileUpdate: Record<string, unknown> = { referral_code: referralCode };
  if (referredBy) profileUpdate.referred_by = referredBy;

  if ((count ?? 0) < GROUNDBREAKER_CAP) {
    profileUpdate.groundbreaker = true;
    profileUpdate.groundbreaker_number = (count ?? 0) + 1;
    profileUpdate.plan = "nursery";
  }

  await admin.from("profiles").update(profileUpdate).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
