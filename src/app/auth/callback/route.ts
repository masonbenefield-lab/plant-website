import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { EmailOtpType } from "@supabase/supabase-js";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";
import { geoCountry, isGeoAllowed } from "@/lib/geo";

async function handleSession(
  user: { id: string; email?: string; created_at: string },
  origin: string,
  next: string,
  country: string | null
) {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("groundbreaker, username, display_name")
    .eq("id", user.id)
    .single();

  // No profile yet = brand-new signup (there's no DB trigger that creates one).
  if (!profile?.username) {
    // US-only gate: drop the just-created account and bounce non-US signups.
    // Deleting (vs banning) keeps auth clean and lets a false-positive US user
    // simply retry rather than being stuck in a banned state.
    if (!isGeoAllowed(country)) {
      await admin.auth.admin.deleteUser(user.id).catch(() => {});
      return NextResponse.redirect(`${origin}/us-only`);
    }
    // Google OAuth users who haven't picked a username yet — send to complete setup
    return NextResponse.redirect(`${origin}/signup/complete`);
  }

  const isNewUser = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
  if (isNewUser && next === "/dashboard") next = "/welcome?confirmed=true";

  if (!profile?.groundbreaker) {
    const { count } = await admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("groundbreaker", true);

    if ((count ?? 0) < GROUNDBREAKER_CAP) {
      await admin
        .from("profiles")
        .update({
          groundbreaker: true,
          groundbreaker_number: (count ?? 0) + 1,
          plan: "nursery",
        })
        .eq("id", user.id);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";
  const country = geoCountry(request.headers);

  const supabase = await createClient();

  // PKCE flow — email confirmation, OAuth
  if (code) {
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && session?.user) {
      return handleSession(session.user, origin, next, country);
    }
    // Code already used or expired — if they already have a session they're confirmed, just continue
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.user) {
      return handleSession(existing.user, origin, next, country);
    }
  }

  // OTP / magic link flow — admin-sent magic links, password recovery
  if (tokenHash && type) {
    const { data: { session }, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as EmailOtpType,
    });
    if (!error && session?.user) {
      return handleSession(session.user, origin, next, country);
    }
    // Token already used — check for existing session before erroring
    const { data: { session: existing } } = await supabase.auth.getSession();
    if (existing?.user) {
      return handleSession(existing.user, origin, next, country);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
