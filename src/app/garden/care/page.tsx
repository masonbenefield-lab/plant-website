import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import GardenTabs from "@/components/garden/garden-tabs";
import { CareScheduleClient } from "./care-schedule-client";
import type { PlantWithIntervals, ReminderEntry, CompletedCareEntry } from "./care-schedule-client";

export default async function CareSchedulePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, name, variety, images, location, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  const allPlants = plants ?? [];
  const plantIds = allPlants.map((p) => p.id);

  const { data: lastEvents } = plantIds.length
    ? await supabase
        .from("garden_events")
        .select("plant_id, event_type, event_date")
        .in("plant_id", plantIds)
        .in("event_type", ["watered", "fertilized", "repotted", "pruned"])
        .order("event_date", { ascending: false })
    : { data: [] };

  // Build map: plantId -> { eventType -> lastDate }
  const lastEventMap: Record<string, Record<string, string>> = {};
  for (const ev of lastEvents ?? []) {
    if (!lastEventMap[ev.plant_id]) lastEventMap[ev.plant_id] = {};
    if (!lastEventMap[ev.plant_id][ev.event_type]) {
      lastEventMap[ev.plant_id][ev.event_type] = ev.event_date;
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type CareEntry = {
    plantId: string;
    plantName: string;
    image: string | null;
    location: string | null;
    careType: string;
    eventKey: string;
    interval: number;
    lastDate: string | null;
    daysUntilDue: number;
  };

  const CHECKS = [
    { type: "Water",     eventKey: "watered",    intervalKey: "water_interval_days"     },
    { type: "Fertilize", eventKey: "fertilized", intervalKey: "fertilize_interval_days" },
    { type: "Repot",     eventKey: "repotted",   intervalKey: "repot_interval_days"     },
    { type: "Prune",     eventKey: "pruned",      intervalKey: "prune_interval_days"     },
  ] as const;

  const entries: CareEntry[] = [];

  for (const plant of allPlants) {
    const name = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;
    const image = (plant.images as string[] | null)?.[0] ?? null;
    const location = (plant as Record<string, unknown>).location as string | null ?? null;
    for (const { type, eventKey, intervalKey } of CHECKS) {
      const interval = (plant as Record<string, unknown>)[intervalKey] as number | null;
      if (!interval) continue;
      const lastDateStr = lastEventMap[plant.id]?.[eventKey] ?? null;
      let daysUntilDue: number;
      if (lastDateStr) {
        const last = new Date(lastDateStr + "T00:00:00");
        last.setHours(0, 0, 0, 0);
        const nextDue = new Date(last.getTime() + interval * 86400000);
        daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
      } else {
        daysUntilDue = 0;
      }
      entries.push({ plantId: plant.id, plantName: name, image, location, careType: type, eventKey, interval, lastDate: lastDateStr, daysUntilDue });
    }
  }

  const plantMap = Object.fromEntries(allPlants.map((p) => [p.id, p]));

  // Fetch today's logged care events (to pre-populate the Completed section on load)
  const todayDateStr = today.toISOString().split("T")[0];
  const { data: todayEventData } = plantIds.length
    ? await supabase
        .from("garden_events")
        .select("plant_id, event_type")
        .in("plant_id", plantIds)
        .in("event_type", ["watered", "fertilized", "repotted", "pruned"])
        .eq("event_date", todayDateStr)
    : { data: [] };

  const CARE_TYPE_DISPLAY: Record<string, string> = {
    watered: "Water", fertilized: "Fertilize", repotted: "Repot", pruned: "Prune",
  };
  const completedToday: CompletedCareEntry[] = (todayEventData ?? []).flatMap((ev) => {
    const plant = plantMap[ev.plant_id];
    if (!plant) return [];
    const name = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;
    const image = (plant.images as string[] | null)?.[0] ?? null;
    const loc = (plant as Record<string, unknown>).location as string | null ?? null;
    return [{ plantId: ev.plant_id, plantName: name, image, location: loc, careType: CARE_TYPE_DISPLAY[ev.event_type] ?? ev.event_type }];
  });

  // Fetch non-completed reminders (up to 60 days ahead, include overdue up to 30 days back)
  const pastCutoff = new Date(today.getTime() - 30 * 86400000).toISOString().split("T")[0];
  const { data: rawReminders } = await supabase
    .from("care_reminders")
    .select("id, plant_id, event_type, scheduled_date, notes")
    .eq("user_id", user.id)
    .eq("completed", false)
    .gte("scheduled_date", pastCutoff)
    .order("scheduled_date", { ascending: true });

  const reminderEntries: ReminderEntry[] = (rawReminders ?? []).map((r) => {
    const plant = r.plant_id ? plantMap[r.plant_id] : null;
    const plantName = plant ? (plant.variety ? `${plant.name} — ${plant.variety}` : plant.name) : null;
    const image = plant ? ((plant.images as string[] | null)?.[0] ?? null) : null;
    const scheduled = new Date(r.scheduled_date + "T00:00:00");
    scheduled.setHours(0, 0, 0, 0);
    const daysUntilDue = Math.round((scheduled.getTime() - today.getTime()) / 86400000);
    return {
      id: r.id,
      plantId: r.plant_id ?? null,
      plantName,
      image,
      eventType: r.event_type,
      scheduledDate: r.scheduled_date,
      notes: r.notes ?? null,
      daysUntilDue,
    };
  });

  const plantsWithSchedule = allPlants.filter((p) =>
    p.water_interval_days || p.fertilize_interval_days || p.repot_interval_days || p.prune_interval_days
  );
  const plantsWithoutSchedule = allPlants.filter((p) =>
    !p.water_interval_days && !p.fertilize_interval_days && !p.repot_interval_days && !p.prune_interval_days
  );

  const plantIntervals: PlantWithIntervals[] = allPlants.map((p) => ({
    id: p.id,
    name: p.variety ? `${p.name} — ${p.variety}` : p.name,
    image: (p.images as string[] | null)?.[0] ?? null,
    location: (p as Record<string, unknown>).location as string | null ?? null,
    waterInterval: p.water_interval_days ?? null,
    fertilizeInterval: p.fertilize_interval_days ?? null,
    repotInterval: p.repot_interval_days ?? null,
    pruneInterval: p.prune_interval_days ?? null,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">My Garden</h1>
        <p className="text-muted-foreground text-sm mt-0.5">{allPlants.length} plant{allPlants.length !== 1 ? "s" : ""} tracked</p>
      </div>

      <GardenTabs />

      {allPlants.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-3">🌱</p>
          <p className="font-semibold mb-1">No plants yet</p>
          <p className="text-sm text-muted-foreground mb-4">Add plants to your garden to set up care schedules.</p>
          <Link href="/garden/new" className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors">
            Add your first plant
          </Link>
        </div>
      ) : (
        <CareScheduleClient
          entries={entries}
          reminderEntries={reminderEntries}
          completedToday={completedToday}
          plantsWithoutSchedule={plantsWithoutSchedule.map((p) => ({
            id: p.id,
            name: p.variety ? `${p.name} — ${p.variety}` : p.name,
            image: (p.images as string[] | null)?.[0] ?? null,
          }))}
          totalWithSchedule={plantsWithSchedule.length}
          plantIntervals={plantIntervals}
        />
      )}
    </div>
  );
}
