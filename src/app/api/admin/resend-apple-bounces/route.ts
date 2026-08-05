import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendWelcomeEmail, sendGiveawayEntryEmail } from "@/lib/email";

export const maxDuration = 120;

// ─── One-time backfill: Apple Hide-My-Email bounces ──────────────────────────
// Every email to an @privaterelay.appleid.com address bounced until 2026-08-05,
// when the plantet.shop sending domain was registered with Apple's private email
// relay. This route re-sends the welcome + giveaway-entry emails those users
// missed. GET = dry-run preview (no sends). POST = actually send.

const RELAY_SUFFIX = "@privaterelay.appleid.com";
// The relay registration went live on this date; every relay send before it
// bounced. Gating on created_at means re-clicking, or a NEW Apple signup after
// the fix (whose mail now delivers), can never be double-sent by this tool.
const FIX_LIVE_AT = Date.parse("2026-08-05T00:00:00Z");
// The owner's own Apple test account — skip it.
const SKIP_EMAILS = new Set(["m8w6c4rvyv@privaterelay.appleid.com"]);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// "2026-08" -> "August 2026"
function monthLabel(month: string): string {
  return new Date(`${month}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

interface EntryTarget {
  month: string;
  plantName: string;
  monthLabel: string;
}
interface Target {
  userId: string;
  email: string;
  username: string;
  displayName: string | null;
  referralCode: string | null;
  entries: EntryTarget[];
}

async function computeTargets(admin: SupabaseClient<Database>): Promise<Target[]> {
  // 1. Apple relay users, created before the fix went live.
  const relay: { id: string; email: string }[] = [];
  let page = 1;
  for (;;) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = data?.users ?? [];
    for (const u of users) {
      const email = (u.email || "").toLowerCase();
      if (!email.endsWith(RELAY_SUFFIX)) continue;
      if (SKIP_EMAILS.has(email)) continue;
      if (!u.created_at || Date.parse(u.created_at) >= FIX_LIVE_AT) continue;
      relay.push({ id: u.id, email: u.email! });
    }
    if (users.length < 1000) break;
    page++;
  }
  if (!relay.length) return [];

  const ids = relay.map((r) => r.id);

  // 2. Profiles. Only users who completed onboarding ever had a welcome sent, so
  //    a relay user with no profile abandoned signup and gets nothing.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, referral_code")
    .in("id", ids);
  const profById = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as { id: string; username: string; display_name: string | null; referral_code: string | null },
    ])
  );

  // 3. Giveaway entries + the plant for each entered month.
  const { data: entries } = await admin
    .from("giveaway_entries")
    .select("user_id, month")
    .in("user_id", ids);
  const months = [...new Set((entries ?? []).map((e) => e.month))];
  const plantByMonth = new Map<string, string>();
  if (months.length) {
    const { data: gm } = await admin
      .from("giveaway_months")
      .select("month, plant_name")
      .in("month", months);
    for (const g of gm ?? []) plantByMonth.set(g.month, g.plant_name);
  }
  const entriesByUser = new Map<string, EntryTarget[]>();
  for (const e of entries ?? []) {
    const plantName = plantByMonth.get(e.month);
    if (!plantName) continue; // no giveaway record for that month → skip
    if (!entriesByUser.has(e.user_id)) entriesByUser.set(e.user_id, []);
    entriesByUser.get(e.user_id)!.push({ month: e.month, plantName, monthLabel: monthLabel(e.month) });
  }

  const targets: Target[] = [];
  for (const r of relay) {
    const p = profById.get(r.id);
    if (!p) continue; // never completed onboarding
    targets.push({
      userId: r.id,
      email: r.email,
      username: p.username,
      displayName: p.display_name ?? null,
      referralCode: p.referral_code ?? null,
      entries: entriesByUser.get(r.id) ?? [],
    });
  }
  return targets;
}

async function gate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  return { admin };
}

// ── Preview: who would receive what, nothing sent ────────────────────────────
export async function GET() {
  const { error, admin } = await gate();
  if (error) return error;
  const targets = await computeTargets(admin!);
  return NextResponse.json({
    count: targets.length,
    welcomeCount: targets.length,
    entryCount: targets.reduce((n, t) => n + t.entries.length, 0),
    targets: targets.map((t) => ({
      email: t.email,
      username: t.username,
      welcome: true,
      entries: t.entries.map((e) => e.monthLabel),
    })),
  });
}

// ── Send: re-send the missed emails ──────────────────────────────────────────
export async function POST() {
  const { error, admin } = await gate();
  if (error) return error;

  const targets = await computeTargets(admin!);
  const results: Array<{
    email: string;
    username: string;
    welcome: "sent" | "failed";
    welcomeError?: string;
    entries: Array<{ monthLabel: string; status: "sent" | "failed"; error?: string }>;
  }> = [];

  // Spaced sends keep us under Resend's ~2 req/sec limit (see broadcast rate-limit
  // history). Volume here is tiny, so simple sequential sends are fine.
  for (const t of targets) {
    const r: (typeof results)[number] = { email: t.email, username: t.username, welcome: "sent", entries: [] };

    try {
      const res = await sendWelcomeEmail({
        recipientEmail: t.email,
        username: t.username,
        displayName: t.displayName,
      });
      if (res?.error) {
        r.welcome = "failed";
        r.welcomeError = res.error.message;
      }
    } catch (e) {
      r.welcome = "failed";
      r.welcomeError = e instanceof Error ? e.message : String(e);
    }
    await sleep(600);

    for (const en of t.entries) {
      try {
        const res = await sendGiveawayEntryEmail({
          recipientEmail: t.email,
          username: t.username,
          displayName: t.displayName,
          monthLabel: en.monthLabel,
          plantName: en.plantName,
          referralCode: t.referralCode,
        });
        r.entries.push(
          res?.error
            ? { monthLabel: en.monthLabel, status: "failed", error: res.error.message }
            : { monthLabel: en.monthLabel, status: "sent" }
        );
      } catch (e) {
        r.entries.push({
          monthLabel: en.monthLabel,
          status: "failed",
          error: e instanceof Error ? e.message : String(e),
        });
      }
      await sleep(600);
    }

    results.push(r);
  }

  const welcomeSent = results.filter((r) => r.welcome === "sent").length;
  const welcomeFailed = results.filter((r) => r.welcome === "failed").length;
  const entriesSent = results.reduce((n, r) => n + r.entries.filter((e) => e.status === "sent").length, 0);
  const entriesFailed = results.reduce((n, r) => n + r.entries.filter((e) => e.status === "failed").length, 0);

  return NextResponse.json({
    welcomeSent,
    welcomeFailed,
    entriesSent,
    entriesFailed,
    totalEmails: welcomeSent + entriesSent,
    results,
  });
}
