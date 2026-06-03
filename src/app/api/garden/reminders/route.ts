import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, eventType, scheduledDate, notes } = await request.json() as {
    plantId?: string | null;
    eventType: string;
    scheduledDate: string;
    notes?: string | null;
  };

  if (!eventType || !scheduledDate) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  if (plantId) {
    const { data: plant } = await supabase
      .from("garden_plants")
      .select("id")
      .eq("id", plantId)
      .eq("user_id", user.id)
      .single();
    if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("care_reminders")
    .insert({
      user_id: user.id,
      plant_id: plantId ?? null,
      event_type: eventType,
      scheduled_date: scheduledDate,
      notes: notes ?? null,
    })
    .select("id, plant_id, event_type, scheduled_date, notes")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ reminder: data });
}
