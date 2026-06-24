import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendWeeklyCareSummary, type WeeklyCareDay } from "@/lib/email";

export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CARE_CHECKS = [
  { careType: "Water",     eventKey: "watered",    intervalKey: "water_interval_days"     },
  { careType: "Fertilize", eventKey: "fertilized", intervalKey: "fertilize_interval_days" },
  { careType: "Repot",     eventKey: "repotted",   intervalKey: "repot_interval_days"     },
  { careType: "Prune",     eventKey: "pruned",      intervalKey: "prune_interval_days"     },
] as const;

type IntervalKey = typeof CARE_CHECKS[number]["intervalKey"];
type EventKey    = typeof CARE_CHECKS[number]["eventKey"];

const MAX_SHOWN = 10;

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Week range label for subject line: Mon–Sun starting tomorrow
  const weekStart = new Date(today.getTime() + 86400000);
  const weekEnd   = new Date(today.getTime() + 7 * 86400000);
  const fmtShort  = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const weekRange = `${fmtShort(weekStart)} – ${fmtShort(weekEnd)}`;

  // Opted-in profiles (reuse daily_care_emails preference)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, vacation_start, vacation_end, schedule_pause_offset")
    .eq("daily_care_emails", true);

  if (!profiles?.length) return NextResponse.json({ sent: 0, reason: "No eligible profiles" });

  // Skip users currently on vacation
  const activeProfiles = profiles.filter((p) => {
    if (!p.vacation_end) return true;
    const end = new Date(p.vacation_end + "T00:00:00");
    end.setHours(0, 0, 0, 0);
    return end < today;
  });
  if (!activeProfiles.length) return NextResponse.json({ sent: 0, reason: "All users on vacation" });

  const pauseOffsetMap: Record<string, number> = {};
  for (const p of activeProfiles) {
    pauseOffsetMap[p.id] = p.schedule_pause_offset ?? 0;
  }

  const profileIds = activeProfiles.map((p) => p.id);

  const [{ data: allPlants }, { data: customSchedules }] = await Promise.all([
    admin.from("garden_plants")
      .select("id, user_id, name, variety, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
      .in("user_id", profileIds),
    admin.from("custom_care_schedules")
      .select("id, user_id, plant_id, label, interval_days")
      .in("user_id", profileIds),
  ]);

  const plants = (allPlants ?? []).filter((p) =>
    p.water_interval_days || p.fertilize_interval_days || p.repot_interval_days || p.prune_interval_days ||
    (customSchedules ?? []).some((cs) => cs.plant_id === p.id)
  );

  if (!plants.length) return NextResponse.json({ sent: 0, reason: "No scheduled plants" });

  const plantIds = plants.map((p) => p.id);

  const [{ data: events }, { data: snoozes }] = await Promise.all([
    admin.from("garden_events")
      .select("plant_id, event_type, event_date")
      .in("plant_id", plantIds)
      .order("event_date", { ascending: false }),
    admin.from("care_snoozes")
      .select("plant_id, event_type, snoozed_until")
      .in("plant_id", plantIds)
      .gte("snoozed_until", todayStr),
  ]);

  const snoozeMap: Record<string, string> = {};
  for (const s of snoozes ?? []) snoozeMap[`${s.plant_id}-${s.event_type}`] = s.snoozed_until;

  const lastEventByPlantKey: Record<string, Partial<Record<EventKey, string>>> = {};
  const lastEventByKey: Record<string, string> = {};
  for (const ev of events ?? []) {
    if (!lastEventByPlantKey[ev.plant_id]) lastEventByPlantKey[ev.plant_id] = {};
    const key = ev.event_type as EventKey;
    if (!lastEventByPlantKey[ev.plant_id][key]) lastEventByPlantKey[ev.plant_id][key] = ev.event_date;
    const flat = `${ev.plant_id}-${ev.event_type}`;
    if (!lastEventByKey[flat]) lastEventByKey[flat] = ev.event_date;
  }

  // Collect upcoming tasks per user: { dayOffset: 1-7, plantName, careType }
  const userTasks: Record<string, { dayOffset: number; plantName: string; careType: string }[]> = {};

  for (const plant of plants) {
    const plantName = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;
    const pauseOffset = pauseOffsetMap[plant.user_id] ?? 0;

    for (const { careType, eventKey, intervalKey } of CARE_CHECKS) {
      const interval = plant[intervalKey as IntervalKey] as number | null;
      if (!interval) continue;

      const snoozeKey = `${plant.id}-${eventKey}`;
      const snoozeUntil = snoozeMap[snoozeKey] ?? null;

      let daysUntilDue: number;
      if (snoozeUntil) {
        const snooze = new Date(snoozeUntil + "T00:00:00");
        snooze.setHours(0, 0, 0, 0);
        daysUntilDue = Math.round((snooze.getTime() - today.getTime()) / 86400000);
      } else {
        const lastDateStr = lastEventByPlantKey[plant.id]?.[eventKey] ?? null;
        if (lastDateStr) {
          const last = new Date(lastDateStr + "T00:00:00");
          last.setHours(0, 0, 0, 0);
          const nextDue = new Date(last.getTime() + interval * 86400000);
          daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000) + pauseOffset;
        } else {
          daysUntilDue = pauseOffset;
        }
      }

      if (daysUntilDue >= 1 && daysUntilDue <= 7) {
        if (!userTasks[plant.user_id]) userTasks[plant.user_id] = [];
        userTasks[plant.user_id].push({ dayOffset: daysUntilDue, plantName, careType });
      }
    }

    for (const cs of (customSchedules ?? []).filter((s) => s.plant_id === plant.id)) {
      const eventType = `custom:${cs.id}`;
      const snoozeUntil = snoozeMap[`${plant.id}-${eventType}`] ?? null;

      let daysUntilDue: number;
      if (snoozeUntil) {
        const snooze = new Date(snoozeUntil + "T00:00:00");
        snooze.setHours(0, 0, 0, 0);
        daysUntilDue = Math.round((snooze.getTime() - today.getTime()) / 86400000);
      } else {
        const lastDateStr = lastEventByKey[`${plant.id}-${eventType}`] ?? null;
        if (lastDateStr) {
          const last = new Date(lastDateStr + "T00:00:00");
          last.setHours(0, 0, 0, 0);
          const nextDue = new Date(last.getTime() + cs.interval_days * 86400000);
          daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000) + (pauseOffsetMap[plant.user_id] ?? 0);
        } else {
          daysUntilDue = pauseOffsetMap[plant.user_id] ?? 0;
        }
      }

      if (daysUntilDue >= 1 && daysUntilDue <= 7) {
        if (!userTasks[plant.user_id]) userTasks[plant.user_id] = [];
        userTasks[plant.user_id].push({ dayOffset: daysUntilDue, plantName, careType: cs.label });
      }
    }
  }

  const eligibleIds = Object.keys(userTasks);
  if (!eligibleIds.length) return NextResponse.json({ sent: 0, reason: "Nothing due this week" });

  // Page through all auth users so we don't silently drop anyone past the first
  // 1000 once the user base grows.
  const emailMap: Record<string, string> = {};
  for (let page = 1; ; page++) {
    const { data: authData } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    const users = authData?.users ?? [];
    for (const u of users) {
      if (u.email) emailMap[u.id] = u.email;
    }
    if (users.length < 1000) break;
  }
  const profileMap = Object.fromEntries(activeProfiles.map((p) => [p.id, { username: p.username, displayName: (p as { display_name?: string | null }).display_name }]));

  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let sent = 0;
  for (const userId of eligibleIds) {
    const email = emailMap[userId];
    const { username, displayName } = profileMap[userId] ?? {};
    if (!email || !username) continue;

    const tasks = [...(userTasks[userId] ?? [])].sort((a, b) => a.dayOffset - b.dayOffset);
    const totalCount = tasks.length;
    const capped = tasks.slice(0, MAX_SHOWN);

    // Group capped tasks into days
    const dayMap = new Map<number, { plantName: string; careType: string }[]>();
    for (const t of capped) {
      if (!dayMap.has(t.dayOffset)) dayMap.set(t.dayOffset, []);
      dayMap.get(t.dayOffset)!.push({ plantName: t.plantName, careType: t.careType });
    }
    const days: WeeklyCareDay[] = [...dayMap.keys()].sort((a, b) => a - b).map((offset) => {
      const d = new Date(today.getTime() + offset * 86400000);
      const label = `${DAY_LABELS[d.getDay()]}, ${MONTH_LABELS[d.getMonth()]} ${d.getDate()}`;
      return { label, tasks: dayMap.get(offset)! };
    });

    try {
      await sendWeeklyCareSummary({ recipientEmail: email, username, displayName, days, totalCount, weekRange });
      sent++;
    } catch {
      // continue on individual failure
    }
  }

  return NextResponse.json({ sent, total: eligibleIds.length, weekRange });
}
