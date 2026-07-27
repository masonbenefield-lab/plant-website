import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Deletes genuinely-abandoned, never-confirmed email signups.
//
// Why: `supabase.auth.signUp` creates an `auth.users` row immediately, before
// the person clicks the email confirmation link. If they never confirm, that
// row lingers forever — and later, if that same email tries "Sign in with Apple"
// (or Google), Supabase can't auto-link (auto-linking requires the existing
// email to be CONFIRMED) and rejects the sign-in. The new user then thinks they
// "already have an account." Clearing out these dead rows removes the collision
// at the source. See NOTES.md 2026-07-27 and src/lib/auth-errors.ts.
//
// Safety rails — a row is only deleted when ALL of these hold:
//   • email was never confirmed (email_confirmed_at is null)
//   • phone was never confirmed either (phone_confirmed_at is null)
//   • the ONLY identity is `email` (never an OAuth user — those are confirmed)
//   • it's older than the TTL below, well past the confirmation-link expiry, so
//     the link is already dead and the account can never be salvaged anyway
//   • no `profiles` row exists for it (belt-and-suspenders: real accounts survive)

const UNCONFIRMED_TTL_DAYS = 3;
const PER_PAGE = 1000;
const MAX_PAGES = 50; // runaway guard (50k users)

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = adminClient();
  const cutoff = Date.now() - UNCONFIRMED_TTL_DAYS * 24 * 60 * 60 * 1000;

  // 1. Page through auth users and collect the abandoned-unconfirmed candidates.
  const candidates: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const users = data?.users ?? [];
    for (const u of users) {
      if (u.email_confirmed_at || u.phone_confirmed_at) continue;
      if (new Date(u.created_at).getTime() >= cutoff) continue;
      const identities = u.identities ?? [];
      const emailOnly = identities.every((i) => i.provider === "email");
      if (!emailOnly) continue;
      candidates.push(u.id);
    }

    if (users.length < PER_PAGE) break; // last page
  }

  if (candidates.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }

  // 2. Never delete anyone who somehow has a profile row (real, set-up account).
  const withProfile = new Set<string>();
  for (let i = 0; i < candidates.length; i += 1000) {
    const chunk = candidates.slice(i, i + 1000);
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id")
      .in("id", chunk);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    for (const p of profiles ?? []) withProfile.add(p.id);
  }

  // 3. Delete the survivors.
  let deleted = 0;
  const failures: string[] = [];
  for (const id of candidates) {
    if (withProfile.has(id)) continue;
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) failures.push(id);
    else deleted++;
  }

  return NextResponse.json({
    ok: true,
    scanned: candidates.length,
    skippedWithProfile: withProfile.size,
    deleted,
    failed: failures.length,
  });
}
