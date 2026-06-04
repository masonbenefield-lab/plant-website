import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { events } = await request.json() as {
    events: { eventId: string; notes: string }[];
  };

  if (!Array.isArray(events) || events.length === 0) {
    return NextResponse.json({ error: "No events provided" }, { status: 400 });
  }

  const toSave = events.filter((e) => e.notes?.trim());
  if (toSave.length === 0) return NextResponse.json({ ok: true });

  const results = await Promise.all(
    toSave.map(({ eventId, notes }) =>
      supabase
        .from("garden_events")
        .update({ notes: notes.trim() })
        .eq("id", eventId)
        .eq("user_id", user.id)
    )
  );

  const failed = results.filter((r) => r.error).length;
  if (failed > 0) return NextResponse.json({ error: "Some updates failed" }, { status: 500 });

  return NextResponse.json({ ok: true });
}
