import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GardenEventType } from "@/lib/supabase/types";

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

  const { items } = await request.json() as { items: { plantId: string; careType: string }[] };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  // Verify all plants belong to this user
  const plantIds = [...new Set(items.map((i) => i.plantId))];
  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id")
    .in("id", plantIds)
    .eq("user_id", user.id);

  const validIds = new Set((plants ?? []).map((p) => p.id));
  const today = new Date().toISOString().split("T")[0];

  const events = items
    .filter((i) => validIds.has(i.plantId) && CARE_EVENT_MAP[i.careType])
    .map((i) => ({
      plant_id:   i.plantId,
      user_id:    user.id,
      event_type: CARE_EVENT_MAP[i.careType],
      event_date: today,
    }));

  if (events.length === 0) {
    return NextResponse.json({ error: "No valid items" }, { status: 400 });
  }

  const { error } = await supabase.from("garden_events").insert(events);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, logged: events.length });
}
