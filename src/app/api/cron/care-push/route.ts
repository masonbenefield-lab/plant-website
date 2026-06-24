import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { hourInTz, todayStrInTz, midnight } from "@/lib/care-date";

export const maxDuration = 300;

// Runs hourly. Sends a once-daily app push to opted-in users when it's their
// local morning and they have plant care due that day. Email is never involved.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CARE_CHECKS = [
  { eventKey: "watered",    intervalKey: "water_interval_days"     },
  { eventKey: "fertilized", intervalKey: "fertilize_interval_days" },
  { eventKey: "repotted",   intervalKey: "repot_interval_days"     },
  { eventKey: "pruned",     intervalKey: "prune_interval_days"     },
] as const;

const REMINDER_HOUR = 8; // 8am local

type Profile = {
  id: string; timezone: string | null;
  vacation_start: string | null; vacation_end: string | null;
  schedule_pause_offset: number | null;
};

function pauseOffsetFor(p: Profile, todayMs: number): number {
  let off = p.schedule_pause_offset ?? 0;
  if (p.vacation_start) {
    let endPoint = todayMs;
    if (p.vacation_end) endPoint = Math.min(endPoint, midnight(p.vacation_end).getTime());
    const elapsed = Math.floor((endPoint - midnight(p.vacation_start).getTime()) / 86400000);
    if (elapsed > 0) off += elapsed;
  }
  return off;
}

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: optedIn } = await admin
    .from("profiles")
    .select("id, timezone, vacation_start, vacation_end, schedule_pause_offset")
    .eq("care_push_reminders", true);

  if (!optedIn?.length) return NextResponse.json({ sent: 0, reason: "None opted in" });

  // Only users for whom it's currently the reminder hour, and not on vacation.
  const eligible = (optedIn as Profile[]).filter((p) => {
    if (hourInTz(p.timezone) !== REMINDER_HOUR) return false;
    if (p.vacation_end && p.vacation_end >= todayStrInTz(p.timezone)) return false;
    return true;
  });
  if (!eligible.length) return NextResponse.json({ sent: 0, reason: "Nobody in the morning window" });

  const userIds = eligible.map((p) => p.id);
  const byUser: Record<string, Profile> = Object.fromEntries(eligible.map((p) => [p.id, p]));

  const [{ data: allPlants }, { data: customs }] = await Promise.all([
    admin.from("garden_plants")
      .select("id, user_id, status, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
      .in("user_id", userIds),
    admin.from("custom_care_schedules")
      .select("id, user_id, plant_id, interval_days").in("user_id", userIds),
  ]);

  const plants = (allPlants ?? []).filter((p) =>
    p.status !== "dormant" && p.status !== "dead" &&
    (p.water_interval_days || p.fertilize_interval_days || p.repot_interval_days || p.prune_interval_days ||
      (customs ?? []).some((cs) => cs.plant_id === p.id))
  );
  const plantIds = plants.map((p) => p.id);
  if (!plantIds.length) return NextResponse.json({ sent: 0, reason: "No active scheduled plants" });

  const [{ data: events }, { data: snoozes }] = await Promise.all([
    admin.from("garden_events")
      .select("plant_id, event_type, event_date").in("plant_id", plantIds).order("event_date", { ascending: false }),
    admin.from("care_snoozes")
      .select("plant_id, event_type, snoozed_until").in("plant_id", plantIds),
  ]);

  const snoozeMap: Record<string, string> = {};
  for (const s of snoozes ?? []) snoozeMap[`${s.plant_id}-${s.event_type}`] = s.snoozed_until;

  // Latest event per plant+event_type.
  const lastEvent: Record<string, string> = {};
  for (const ev of events ?? []) {
    const key = `${ev.plant_id}-${ev.event_type}`;
    if (!lastEvent[key]) lastEvent[key] = ev.event_date;
  }

  // Count tasks due today (or overdue) per user.
  const dueCount: Record<string, number> = {};
  for (const plant of plants) {
    const p = byUser[plant.user_id];
    const todayStr = todayStrInTz(p.timezone);
    const todayMs = midnight(todayStr).getTime();
    const pauseOffset = pauseOffsetFor(p, todayMs);

    const consider = (eventKey: string, interval: number) => {
      const snoozeUntil = snoozeMap[`${plant.id}-${eventKey}`] ?? null;
      let daysUntilDue: number;
      if (snoozeUntil && snoozeUntil >= todayStr) {
        daysUntilDue = Math.round((midnight(snoozeUntil).getTime() - todayMs) / 86400000);
      } else {
        const lastDateStr = lastEvent[`${plant.id}-${eventKey}`] ?? null;
        daysUntilDue = lastDateStr
          ? Math.round((midnight(lastDateStr).getTime() + interval * 86400000 - todayMs) / 86400000) + pauseOffset
          : pauseOffset;
      }
      if (daysUntilDue <= 0) dueCount[plant.user_id] = (dueCount[plant.user_id] ?? 0) + 1;
    };

    for (const { eventKey, intervalKey } of CARE_CHECKS) {
      const interval = (plant as Record<string, unknown>)[intervalKey] as number | null;
      if (interval) consider(eventKey, interval);
    }
    for (const cs of (customs ?? []).filter((c) => c.plant_id === plant.id)) {
      consider(`custom:${cs.id}`, cs.interval_days);
    }
  }

  let sent = 0;
  for (const userId of Object.keys(dueCount)) {
    const n = dueCount[userId];
    if (n < 1) continue;
    await sendPushToUser(
      userId,
      "🌿 Plant care today",
      `${n} plant${n > 1 ? "s" : ""} need${n > 1 ? "" : "s"} care today`,
      { url: "/garden/care" }
    );
    sent++;
  }

  return NextResponse.json({ sent, eligible: eligible.length });
}
