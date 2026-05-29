import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendWelcomeEmail } from "@/lib/email";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!user.email || !profile?.username) {
    return NextResponse.json({ error: "Missing user data" }, { status: 400 });
  }

  await sendWelcomeEmail({ recipientEmail: user.email, username: profile.username });
  return NextResponse.json({ ok: true });
}
