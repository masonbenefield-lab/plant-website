import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GardenEventType } from "@/lib/garden-types";

const CARE_EVENT_MAP: Record<string, GardenEventType> = {
  Water:     "watered",
  Fertilize: "fertilized",
  Repot:     "repotted",
  Prune:     "pruned",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { items, date } = await request.json() as {
    items: { plantId: string; careType: string; eventKey?: string }[];
    date?: string;
  };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  const plantIds = [...new Set(items.map((i) => i.plantId))];
  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, name, variety")
    .in("id", plantIds)
    .eq("user_id", user.id);

  const validIds = new Set((plants ?? []).map((p) => p.id));
  const plantNames = Object.fromEntries(
    (plants ?? []).map((p) => [p.id, p.variety ? `${p.name} — ${p.variety}` : p.name])
  );

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const eventDate = date ?? todayStr;

  // eventKey (e.g. "custom:<uuid>" or "watered") takes precedence; fall back to
  // the built-in map. This lets custom care types bulk-log too (previously they
  // were silently dropped because the map only knows built-ins).
  const resolveType = (i: { careType: string; eventKey?: string }): string | undefined =>
    i.eventKey ?? CARE_EVENT_MAP[i.careType];
  const validItems = items.filter((i) => validIds.has(i.plantId) && resolveType(i));
  if (validItems.length === 0) return NextResponse.json({ error: "No valid items" }, { status: 400 });

  const events = validItems.map((i) => ({
    plant_id:   i.plantId,
    user_id:    user.id,
    event_type: resolveType(i) as GardenEventType,
    event_date: eventDate,
    notes:      null as string | null,
  }));

  const { data: inserted, error } = await supabase
    .from("garden_events")
    .insert(events)
    .select("id, plant_id, event_type");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const loggedEvents = (inserted ?? []).map((ev, idx) => ({
    eventId:   ev.id,
    plantId:   ev.plant_id,
    plantName: plantNames[ev.plant_id] ?? ev.plant_id,
    careType:  validItems[idx]?.careType ?? "",
  }));

  return NextResponse.json({ ok: true, logged: loggedEvents.length, events: loggedEvents });
}
