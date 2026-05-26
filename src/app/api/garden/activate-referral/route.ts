import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if user was referred and hasn't activated yet
  const { data: profile } = await admin
    .from("profiles")
    .select("referred_by")
    .eq("id", user.id)
    .single();

  if (!profile?.referred_by) return NextResponse.json({ ok: true, skipped: "no referrer" });

  // Idempotent — UNIQUE(referred_id) means a second call is a no-op
  const { error } = await admin
    .from("referral_activations")
    .insert({ referrer_id: profile.referred_by, referred_id: user.id })
    .select()
    .single();

  // 23505 = unique_violation — already activated, that's fine
  if (error && error.code !== "23505") {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  if (!error) {
    // Increment lifetime referral counter on the referrer
    const { data: referrer } = await admin
      .from("profiles")
      .select("total_referrals")
      .eq("id", profile.referred_by)
      .single();
    await admin
      .from("profiles")
      .update({ total_referrals: (referrer?.total_referrals ?? 0) + 1 })
      .eq("id", profile.referred_by);
  }

  return NextResponse.json({ ok: true });
}
