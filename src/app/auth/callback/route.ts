import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && session?.user) {
      const admin = createAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: profile } = await admin
        .from("profiles")
        .select("groundbreaker")
        .eq("id", session.user.id)
        .single();

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
            .eq("id", session.user.id);
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
