import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
type GardenEventType = Database["public"]["Tables"]["garden_events"]["Insert"]["event_type"];

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

  const { plantId, careType, date, notes } = await request.json() as {
    plantId: string;
    careType: string;
    date?: string;
    notes?: string;
  };
  const eventType = CARE_EVENT_MAP[careType];
  if (!plantId || !eventType) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

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
      event_type: eventType,
      event_date: eventDate,
      notes: notes ?? null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, eventId: event.id });
}
