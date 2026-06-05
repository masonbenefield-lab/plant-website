import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GardenEventType } from "@/lib/garden-types";

const CARE_EVENT_MAP: Record<string, GardenEventType> = {
  Water: "watered",
  Fertilize: "fertilized",
  Repot: "repotted",
  Prune: "pruned",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, careType, eventKey, date, notes } = await request.json() as {
    plantId: string;
    careType: string;
    eventKey?: string;   // provided for custom care types (e.g. "custom:<uuid>")
    date?: string;
    notes?: string;
  };

  // eventKey takes precedence; fall back to CARE_EVENT_MAP for built-in types
  const resolvedEventType: string | undefined = eventKey ?? CARE_EVENT_MAP[careType];
  if (!plantId || !resolvedEventType) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: plant } = await supabase
    .from("garden_plants")
    .select("id")
    .eq("id", plantId)
    .eq("user_id", user.id)
    .single();

  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const eventDate = date ?? todayStr;

  const { data: event, error } = await supabase
    .from("garden_events")
    .insert({
      plant_id: plantId,
      user_id: user.id,
      event_type: resolvedEventType,
      event_date: eventDate,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Clear any active snooze for this plant+event_type on log
  await supabase
    .from("care_snoozes")
    .delete()
    .eq("user_id", user.id)
    .eq("plant_id", plantId)
    .eq("event_type", resolvedEventType);

  return NextResponse.json({ ok: true, eventId: event.id });
}
