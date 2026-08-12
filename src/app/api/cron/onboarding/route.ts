import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOnboardingEmail, sendFirstPlantNudge } from "@/lib/email";

export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Each cohort is a 24-hour signup window; the daily cron tiles these windows with no
  // overlap, which is what prevents duplicate sends (no per-user sent flag needed).
  const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

  // Shared: emails from auth (used by both cohorts).
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  // ── Cohort 1: day-3 onboarding — signed up between 3 and 2 days ago ──────────
  const { data: onboardProfiles, error } = await admin
    .from("profiles")
    .select("id, username, display_name, referral_code")
    .gte("created_at", daysAgo(3))
    .lt("created_at", daysAgo(2))
    .is("deleted_at", null);

  let onboarding = 0;
  for (const profile of onboardProfiles ?? []) {
    const email = emailMap[profile.id];
    if (!email) continue;
    try {
      await sendOnboardingEmail({
        recipientEmail: email,
        username: profile.username,
        displayName: (profile as { display_name?: string | null }).display_name,
        referralCode: (profile as { referral_code?: string | null }).referral_code,
      });
      onboarding++;
    } catch {
      // continue on individual failure
    }
  }

  // ── Cohort 2: day-10 first-plant nudge — signed up between 11 and 10 days ago,
  // and STILL has zero garden plants. Fills the gap between the day-3 onboarding and
  // the 45-day re-engagement email, driving the one action that starts care reminders.
  const { data: nudgeProfiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .gte("created_at", daysAgo(11))
    .lt("created_at", daysAgo(10))
    .is("deleted_at", null);

  let firstPlantNudge = 0;
  if (nudgeProfiles?.length) {
    const nudgeIds = nudgeProfiles.map((p) => p.id);
    const { data: plantRows } = await admin
      .from("garden_plants")
      .select("user_id")
      .in("user_id", nudgeIds);
    const hasPlant = new Set((plantRows ?? []).map((r) => r.user_id));

    for (const profile of nudgeProfiles) {
      if (hasPlant.has(profile.id)) continue; // already logged a plant — retention loop is live
      const email = emailMap[profile.id];
      if (!email) continue;
      try {
        await sendFirstPlantNudge({
          recipientEmail: email,
          username: profile.username,
          displayName: (profile as { display_name?: string | null }).display_name,
          userId: profile.id,
        });
        firstPlantNudge++;
      } catch {
        // continue on individual failure
      }
    }
  }

  return NextResponse.json({
    onboarding,
    firstPlantNudge,
    onboardingTotal: onboardProfiles?.length ?? 0,
    nudgeEligible: nudgeProfiles?.length ?? 0,
    error: error?.message,
  });
}
