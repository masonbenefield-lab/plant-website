import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const month = new Date().toISOString().slice(0, 7); // "2026-05"

  // Verify an active giveaway exists for this month
  const { data: giveaway } = await supabase
    .from("giveaway_months")
    .select("month")
    .eq("month", month)
    .single();

  if (!giveaway) return NextResponse.json({ error: "No active giveaway this month" }, { status: 400 });

  const { error } = await supabase
    .from("giveaway_entries")
    .insert({ user_id: user.id, month });

  if (error) {
    if (error.code === "23505") {
      // Already entered — not an error from the user's perspective
      return NextResponse.json({ already: true });
    }
    return NextResponse.json({ error: "Failed to enter" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
