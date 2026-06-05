import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { vacation_end: "YYYY-MM-DD" } — activate vacation mode starting today
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { vacation_end?: string };
  if (!body.vacation_end) return NextResponse.json({ error: "vacation_end required" }, { status: 400 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split("T")[0];

  const { error } = await supabase
    .from("profiles")
    .update({ vacation_start: todayStr, vacation_end: body.vacation_end })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE — end vacation early; accrues elapsed pause days into schedule_pause_offset
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("vacation_start, schedule_pause_offset")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let additionalOffset = 0;
  if (profile.vacation_start) {
    const start = new Date(profile.vacation_start + "T00:00:00");
    start.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    additionalOffset = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000));
  }

  const newOffset = (profile.schedule_pause_offset ?? 0) + additionalOffset;

  const { error } = await supabase
    .from("profiles")
    .update({ vacation_start: null, vacation_end: null, schedule_pause_offset: newOffset })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, newOffset });
}
