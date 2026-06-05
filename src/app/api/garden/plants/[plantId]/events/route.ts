import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ plantId: string }> }
) {
  const { plantId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: plant } = await supabase
    .from("garden_plants")
    .select("id")
    .eq("id", plantId)
    .eq("user_id", user.id)
    .single();
  if (!plant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: events } = await supabase
    .from("garden_events")
    .select("id, event_type, event_date, notes")
    .eq("plant_id", plantId)
    .eq("user_id", user.id)
    .in("event_type", ["watered", "fertilized", "repotted", "pruned"])
    .order("event_date", { ascending: false })
    .limit(50);

  return NextResponse.json({ events: events ?? [] });
}
