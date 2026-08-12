import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReengagementEmail } from "@/lib/email";

export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INACTIVE_DAYS = 45;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fortyFiveDaysAgo = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1 — opted-in users who haven't received a re-engagement email recently
  // Exclude users who signed up within the last 30 days — they get the day-3
  // onboarding email instead and shouldn't receive re-engagement so soon.
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .eq("email_marketing_opt_in", true)
    .lt("created_at", thirtyDaysAgo)
    .or(`last_reengagement_sent.is.null,last_reengagement_sent.lt.${fortyFiveDaysAgo}`);

  if (profileErr || !profiles?.length) {
    return NextResponse.json({ sent: 0, error: profileErr?.message ?? "No eligible users" });
  }

  // 2 — get emails + last_sign_in_at from auth
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  const lastSignInMap: Record<string, string | null> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
    lastSignInMap[u.id] = u.last_sign_in_at ?? null;
  }

  // 3 — filter to users inactive for 45+ days
  const inactiveProfiles = profiles.filter((p) => {
    const lastSignIn = lastSignInMap[p.id];
    if (!lastSignIn) return true; // never signed in — also re-engage
    return lastSignIn < fortyFiveDaysAgo;
  });

  if (!inactiveProfiles.length) {
    return NextResponse.json({ sent: 0, total: profiles.length, reason: "No inactive users" });
  }

  // 4 — send emails. The email leads with the garden/care value prop (log a plant →
  // get watering reminders), not the marketplace: with inventory still thin, a win-back
  // email opening on a near-empty shop confirms "nothing here." Garden/care works at any
  // seller count and is the only feature with a recurring reason to return. The shop gets
  // a single soft footer line inside the template. Revisit showing live listings here once
  // inventory is deep enough that the shop reads as alive.
  let sent = 0;
  const sentIds: string[] = [];

  for (const profile of inactiveProfiles) {
    const email = emailMap[profile.id];
    if (!email) continue;

    try {
      await sendReengagementEmail({
        recipientEmail: email,
        username: profile.username,
        displayName: (profile as { display_name?: string | null }).display_name,
        userId: profile.id,
      });
      sentIds.push(profile.id);
      sent++;
    } catch {
      // continue on individual send failure
    }
  }

  // 5 — mark re-engagement sent
  if (sentIds.length) {
    await admin
      .from("profiles")
      .update({ last_reengagement_sent: new Date().toISOString() })
      .in("id", sentIds);
  }

  return NextResponse.json({ sent, total: inactiveProfiles.length });
}
