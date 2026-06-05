import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDailyCareReminder, type DailyCareItem, type OneTimeCareItem } from "@/lib/email";

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

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // 1 — opted-in profiles (include vacation fields to skip vacationing users + apply pause offset)
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, vacation_start, vacation_end, schedule_pause_offset")
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

  // Build pause-offset map per user
  const pauseOffsetMap: Record<string, number> = {};
  for (const p of activeProfiles) {
    pauseOffsetMap[p.id] = p.schedule_pause_offset ?? 0;
  }

  const profileIds = activeProfiles.map((p) => p.id);

  // 2 — fetch all garden plants with intervals for these users
  const { data: plants } = await admin
    .from("garden_plants")
    .select("id, user_id, name, variety, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
    .in("user_id", profileIds)
    .or("water_interval_days.not.is.null,fertilize_interval_days.not.is.null,repot_interval_days.not.is.null,prune_interval_days.not.is.null");

  if (!plants?.length) return NextResponse.json({ sent: 0, reason: "No scheduled plants" });

  const plantIds = plants.map((p) => p.id);

  // 3 — fetch latest event per plant per event type
  const { data: events } = await admin
    .from("garden_events")
    .select("plant_id, event_type, event_date")
    .in("plant_id", plantIds)
    .in("event_type", ["watered", "fertilized", "repotted", "pruned"])
    .order("event_date", { ascending: false });

  // Build lastEvent map: plantId → eventKey → date string
  const lastEvent: Record<string, Partial<Record<EventKey, string>>> = {};
  for (const ev of events ?? []) {
    if (!lastEvent[ev.plant_id]) lastEvent[ev.plant_id] = {};
    const key = ev.event_type as EventKey;
    if (!lastEvent[ev.plant_id][key]) lastEvent[ev.plant_id][key] = ev.event_date;
  }

  // 4 — compute due items per user
  const userItems: Record<string, DailyCareItem[]> = {};

  for (const plant of plants) {
    const plantName = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;
    for (const { careType, eventKey, intervalKey } of CARE_CHECKS) {
      const interval = plant[intervalKey as IntervalKey] as number | null;
      if (!interval) continue;

      const lastDateStr = lastEvent[plant.id]?.[eventKey] ?? null;
      let daysUntilDue: number;

      const pauseOffset = pauseOffsetMap[plant.user_id] ?? 0;
      if (lastDateStr) {
        const last = new Date(lastDateStr + "T00:00:00");
        last.setHours(0, 0, 0, 0);
        const nextDue = new Date(last.getTime() + interval * 86400000);
        daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000) + pauseOffset;
      } else {
        daysUntilDue = pauseOffset;
      }

      if (daysUntilDue <= 0) {
        if (!userItems[plant.user_id]) userItems[plant.user_id] = [];
        userItems[plant.user_id].push({ plantName, careType, daysOverdue: Math.abs(daysUntilDue) });
      }
    }
  }

  // 4b — one-time reminders due today or overdue (up to 7 days back)
  const pastCutoff7 = new Date(today.getTime() - 7 * 86400000);
  const pastCutoff7Str = `${pastCutoff7.getFullYear()}-${String(pastCutoff7.getMonth() + 1).padStart(2, "0")}-${String(pastCutoff7.getDate()).padStart(2, "0")}`;
  const { data: oneTimeRaw } = await admin
    .from("care_reminders")
    .select("id, user_id, plant_id, event_type, notes")
    .in("user_id", profileIds)
    .gte("scheduled_date", pastCutoff7Str)
    .lte("scheduled_date", todayStr)
    .eq("completed", false);

  const userOneTimeItems: Record<string, OneTimeCareItem[]> = {};
  if (oneTimeRaw?.length) {
    const reminderPlantIds = [...new Set(oneTimeRaw.filter((r) => r.plant_id).map((r) => r.plant_id as string))];
    const { data: reminderPlants } = reminderPlantIds.length
      ? await admin.from("garden_plants").select("id, name, variety").in("id", reminderPlantIds)
      : { data: [] };
    const reminderPlantMap = Object.fromEntries(
      (reminderPlants ?? []).map((p) => [p.id, p.variety ? `${p.name} — ${p.variety}` : p.name])
    );
    for (const r of oneTimeRaw) {
      if (!userOneTimeItems[r.user_id]) userOneTimeItems[r.user_id] = [];
      userOneTimeItems[r.user_id].push({
        plantName: r.plant_id ? (reminderPlantMap[r.plant_id] ?? null) : null,
        eventType: r.event_type,
        notes: r.notes ?? null,
      });
    }
  }

  const eligibleIds = [...new Set([...Object.keys(userItems), ...Object.keys(userOneTimeItems)])];
  if (!eligibleIds.length) return NextResponse.json({ sent: 0, reason: "Nothing due today" });

  // 5 — get emails from auth
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  const profileMap = Object.fromEntries(activeProfiles.map((p) => [p.id, p.username]));

  // 6 — send emails
  let sent = 0;
  for (const userId of eligibleIds) {
    const email = emailMap[userId];
    const username = profileMap[userId];
    if (!email || !username) continue;

    try {
      await sendDailyCareReminder({
        recipientEmail: email,
        username,
        userId,
        items: userItems[userId] ?? [],
        oneTimeItems: userOneTimeItems[userId],
      });
      sent++;
    } catch {
      // continue on individual failure
    }
  }

  return NextResponse.json({ sent, total: eligibleIds.length, date: todayStr });
}
