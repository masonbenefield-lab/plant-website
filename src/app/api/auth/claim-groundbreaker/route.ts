import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile } = await admin
    .from("profiles")
    .select("groundbreaker")
    .eq("id", user.id)
    .single();

  if (profile?.groundbreaker) return NextResponse.json({ ok: true, already: true });

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

  return NextResponse.json({ ok: true });
}
