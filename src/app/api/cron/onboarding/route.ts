import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOnboardingEmail } from "@/lib/email";

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

  // Target users who signed up between 3 and 2 days ago (24-hour window prevents duplicates)
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, username, display_name, referral_code")
    .gte("created_at", threeDaysAgo)
    .lt("created_at", twoDaysAgo)
    .is("deleted_at", null);

  if (error || !profiles?.length) {
    return NextResponse.json({ sent: 0, error: error?.message ?? "No eligible users" });
  }

  // Get emails from auth
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  let sent = 0;
  for (const profile of profiles) {
    const email = emailMap[profile.id];
    if (!email) continue;
    try {
      await sendOnboardingEmail({
        recipientEmail: email,
        username: profile.username,
        displayName: (profile as { display_name?: string | null }).display_name,
        referralCode: (profile as { referral_code?: string | null }).referral_code,
      });
      sent++;
    } catch {
      // continue on individual failure
    }
  }

  return NextResponse.json({ sent, total: profiles.length });
}
