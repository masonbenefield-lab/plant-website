import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST { plantId, eventType, snoozedUntil } — upsert a snooze
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, eventType, snoozedUntil } = await request.json() as {
    plantId: string; eventType: string; snoozedUntil: string;
  };
  if (!plantId || !eventType || !snoozedUntil) {
    return NextResponse.json({ error: "plantId, eventType, snoozedUntil required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("care_snoozes")
    .upsert({ user_id: user.id, plant_id: plantId, event_type: eventType, snoozed_until: snoozedUntil },
             { onConflict: "plant_id,event_type" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE { plantId, eventType } — clear a snooze
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, eventType } = await request.json() as { plantId: string; eventType: string };

  const { error } = await supabase
    .from("care_snoozes")
    .delete()
    .eq("user_id", user.id)
    .eq("plant_id", plantId)
    .eq("event_type", eventType);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
