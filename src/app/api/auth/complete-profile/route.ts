import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";
import { containsSlur } from "@/lib/profanity";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { username, displayName, emailOptIn } = await req.json();

  if (
    !username ||
    username.length < 3 ||
    username.length > 30 ||
    !/^[a-z0-9._-]+$/.test(username)
  ) {
    return NextResponse.json({ error: "Invalid username format." }, { status: 400 });
  }

  if (containsSlur(username)) {
    return NextResponse.json({ error: "Username contains a prohibited word." }, { status: 400 });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // If profile already exists, just redirect — don't error
  const { data: existing } = await admin.from("profiles").select("id").eq("id", user.id).single();
  if (existing) {
    return NextResponse.json({ ok: true, alreadyExists: true });
  }

  // Check username uniqueness
  const { data: taken } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
  if (taken) {
    return NextResponse.json({ error: "Username is already taken. Please choose another." }, { status: 409 });
  }

  // Groundbreaker check
  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("groundbreaker", true);

  const isGroundbreaker = (count ?? 0) < GROUNDBREAKER_CAP;

  const { error: insertError } = await admin.from("profiles").insert({
    id: user.id,
    username,
    display_name: displayName ?? null,
    plan: isGroundbreaker ? "nursery" : "seedling",
    groundbreaker: isGroundbreaker,
    groundbreaker_number: isGroundbreaker ? (count ?? 0) + 1 : null,
    email_marketing_opt_in: emailOptIn ?? false,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json({ error: "Username is already taken. Please choose another." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create profile. Please try again." }, { status: 500 });
  }

  if (user.email) {
    sendWelcomeEmail({ recipientEmail: user.email, username }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
