import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ELIGIBLE_COUNTRIES = ["US", "CA"];

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check country eligibility
  const { data: profile } = await supabase
    .from("profiles")
    .select("country")
    .eq("id", user.id)
    .single();

  if (!profile?.country) {
    return NextResponse.json({ error: "Please select your country before entering." }, { status: 400 });
  }
  if (!ELIGIBLE_COUNTRIES.includes(profile.country)) {
    return NextResponse.json({ error: "This giveaway is open to US and Canada residents only." }, { status: 403 });
  }

  const month = new Date().toISOString().slice(0, 7);

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
    if (error.code === "23505") return NextResponse.json({ already: true });
    return NextResponse.json({ error: "Failed to enter" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
