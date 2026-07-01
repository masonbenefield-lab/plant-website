import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  buildAnnouncementHtml,
  sendAnnouncement,
  type AnnouncementEmail,
} from "@/lib/email";

export const maxDuration = 300;

// Sending to a large opted-in list can take a while — do it a few at a time to
// stay clear of provider rate limits while keeping wall-clock reasonable.
const BATCH_SIZE = 5;

type Mode = "preview" | "test" | "send";

interface BroadcastBody extends AnnouncementEmail {
  mode: Mode;
  testEmail?: string;
}

function sampleReferralLink(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  return `${base}/signup?ref=abc123`;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!(profile as { is_admin?: boolean } | null)?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json()) as BroadcastBody;
  const { mode, subject, heading, subheading, bodyMarkdown, ctaLabel, ctaUrl, includeReferralBlock, testEmail } = body;

  const email: AnnouncementEmail = {
    subject,
    heading,
    subheading,
    bodyMarkdown,
    ctaLabel,
    ctaUrl,
    includeReferralBlock,
  };

  // ── Preview: render the HTML without sending anything ──────────────────────
  if (mode === "preview") {
    const html = buildAnnouncementHtml(email, {
      referralLink: includeReferralBlock ? sampleReferralLink() : undefined,
      unsubLink: "#preview-unsubscribe",
    });
    return NextResponse.json({ html });
  }

  if (!subject?.trim() || !heading?.trim() || !bodyMarkdown?.trim()) {
    return NextResponse.json({ error: "Subject, heading, and body are all required." }, { status: 400 });
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ── Test: send to a single address (defaults to the signed-in admin) ──────
  if (mode === "test") {
    const recipient = (testEmail ?? user.email ?? "").trim();
    if (!recipient || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(recipient)) {
      return NextResponse.json({ error: "Enter a valid email address to send the test to." }, { status: 400 });
    }
    const { data: me } = await admin
      .from("profiles")
      .select("referral_code")
      .eq("id", user.id)
      .single();
    await sendAnnouncement({
      recipientEmail: recipient,
      userId: user.id,
      referralCode: (me as { referral_code?: string | null } | null)?.referral_code,
      email,
    });
    return NextResponse.json({ sent: 1, test: true, recipient });
  }

  // ── Send: everyone opted in ───────────────────────────────────────────────
  const { data: recipients, error: recipientErr } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("email_marketing_opt_in", true)
    .is("deleted_at", null);

  if (recipientErr) {
    return NextResponse.json({ error: recipientErr.message }, { status: 500 });
  }
  if (!recipients?.length) {
    return NextResponse.json({ sent: 0, total: 0 });
  }

  // Resolve emails from auth. (Banned recipients are filtered inside the mailer.)
  const emailMap: Record<string, string> = {};
  let page = 1;
  // Paginate so this keeps working past 1000 users.
  for (;;) {
    const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = authData?.users ?? [];
    for (const u of users) {
      if (u.email) emailMap[u.id] = u.email;
    }
    if (users.length < 1000) break;
    page++;
  }

  const targets = recipients
    .map((r) => ({ id: r.id, email: emailMap[r.id], referralCode: (r as { referral_code?: string | null }).referral_code }))
    .filter((t): t is { id: string; email: string; referralCode: string | null | undefined } => Boolean(t.email));

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((t) =>
        sendAnnouncement({
          recipientEmail: t.email,
          userId: t.id,
          referralCode: t.referralCode,
          email,
        })
      )
    );
    for (const r of results) {
      if (r.status === "fulfilled") sent++;
      else failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: targets.length });
}
