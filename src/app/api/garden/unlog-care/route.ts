import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
type GardenEventType = Database["public"]["Tables"]["garden_events"]["Row"]["event_type"];

const CARE_EVENT_MAP: Record<string, GardenEventType> = {
  Water: "watered", Fertilize: "fertilized", Repot: "repotted", Prune: "pruned",
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, careType } = await request.json() as { plantId: string; careType: string };
  const eventType = CARE_EVENT_MAP[careType];
  if (!plantId || !eventType) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const { data: plant } = await supabase
    .from("garden_plants").select("id").eq("id", plantId).eq("user_id", user.id).single();
  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  const today = new Date().toISOString().split("T")[0];
  const { data: event } = await supabase
    .from("garden_events").select("id")
    .eq("plant_id", plantId).eq("user_id", user.id)
    .eq("event_type", eventType).eq("event_date", today)
    .order("created_at", { ascending: false }).limit(1).single();

  if (!event) return NextResponse.json({ error: "No event to unlog" }, { status: 404 });

  const { error } = await supabase.from("garden_events").delete().eq("id", event.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
