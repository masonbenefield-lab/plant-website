import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";
import { sendWelcomeEmail } from "@/lib/email";

async function handleSession(
  user: { id: string; email?: string; created_at: string },
  origin: string,
  next: string
) {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("groundbreaker, username")
    .eq("id", user.id)
    .single();

  const isNewUser = Date.now() - new Date(user.created_at).getTime() < 10 * 60 * 1000;
  if (isNewUser && user.email && profile?.username) {
    sendWelcomeEmail({ recipientEmail: user.email, username: profile.username }).catch(() => {});
  }

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

  const supabase = await createClient();

  // PKCE flow — email confirmation, OAuth
  if (code) {
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && session?.user) {
      return handleSession(session.user, origin, next);
    }
  }

  // OTP / magic link flow — admin-sent magic links, password recovery
  if (tokenHash && type) {
    const { data: { session }, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as Parameters<typeof supabase.auth.verifyOtp>[0]["type"],
    });
    if (!error && session?.user) {
      return handleSession(session.user, origin, next);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
