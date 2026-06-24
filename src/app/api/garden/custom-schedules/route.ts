import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { plantId, label, intervalDays, startDate } — create a custom recurring schedule
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, label, intervalDays, startDate } = await request.json() as {
    plantId: string; label: string; intervalDays: number; startDate: string;
  };
  if (!plantId || !label?.trim() || !intervalDays || !startDate) {
    return NextResponse.json({ error: "plantId, label, intervalDays, startDate required" }, { status: 400 });
  }

  // Verify plant belongs to user
  const { data: plant } = await supabase
    .from("garden_plants").select("id").eq("id", plantId).eq("user_id", user.id).single();
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  // Keep care labels unique per plant so the schedule's internal keys (plant +
  // care label) never collide. Reject built-in names and duplicate labels.
  const labelTrim = label.trim();
  const labelLower = labelTrim.toLowerCase();
  if (["water", "fertilize", "repot", "prune"].includes(labelLower)) {
    return NextResponse.json({ error: "That name is reserved for a built-in care type — pick a different label." }, { status: 400 });
  }
  const { data: existingCustom } = await supabase
    .from("custom_care_schedules").select("label").eq("plant_id", plantId);
  if ((existingCustom ?? []).some((s) => s.label.trim().toLowerCase() === labelLower)) {
    return NextResponse.json({ error: "This plant already has a custom schedule with that name." }, { status: 409 });
  }

  // Insert the schedule
  const { data: schedule, error: schedErr } = await supabase
    .from("custom_care_schedules")
    .insert({ user_id: user.id, plant_id: plantId, label: label.trim(), interval_days: intervalDays, start_date: startDate })
    .select("id")
    .single();

  if (schedErr || !schedule) return NextResponse.json({ error: schedErr?.message ?? "Insert failed" }, { status: 500 });

  // Insert baseline event at startDate - intervalDays (same pattern as built-in types)
  const baselineDate = new Date(startDate + "T00:00:00");
  baselineDate.setHours(0, 0, 0, 0);
  baselineDate.setDate(baselineDate.getDate() - intervalDays);
  // Local-component date string (toISOString would shift it a day in US zones).
  const baselineDateStr = `${baselineDate.getFullYear()}-${String(baselineDate.getMonth() + 1).padStart(2, "0")}-${String(baselineDate.getDate()).padStart(2, "0")}`;
  const eventType = `custom:${schedule.id}`;

  await supabase
    .from("garden_events")
    .insert({ plant_id: plantId, user_id: user.id, event_type: eventType, event_date: baselineDateStr, is_baseline: true } as never);

  return NextResponse.json({ ok: true, schedule: { id: schedule.id, label: label.trim(), interval_days: intervalDays, start_date: startDate } });
}

// DELETE { scheduleId } — remove a custom schedule and its events
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { scheduleId } = await request.json() as { scheduleId: string };
  if (!scheduleId) return NextResponse.json({ error: "scheduleId required" }, { status: 400 });

  // Verify ownership
  const { data: sched } = await supabase
    .from("custom_care_schedules").select("id, plant_id").eq("id", scheduleId).eq("user_id", user.id).single();
  if (!sched) return NextResponse.json({ error: "Schedule not found" }, { status: 404 });

  const eventType = `custom:${scheduleId}`;

  // Clean up baseline event and any snooze
  await Promise.all([
    supabase.from("garden_events").delete().eq("user_id", user.id).eq("plant_id", sched.plant_id).eq("event_type", eventType),
    supabase.from("care_snoozes").delete().eq("user_id", user.id).eq("event_type", eventType),
  ]);

  const { error } = await supabase
    .from("custom_care_schedules").delete().eq("id", scheduleId).eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
