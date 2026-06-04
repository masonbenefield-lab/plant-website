import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { GardenEventType } from "@/lib/supabase/types";

const INTERVAL_TO_EVENT: Record<string, GardenEventType> = {
  waterInterval:     "watered",
  fertilizeInterval: "fertilized",
  repotInterval:     "repotted",
  pruneInterval:     "pruned",
};

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    plantIds: string[];
    waterInterval?: number;
    fertilizeInterval?: number;
    repotInterval?: number;
    pruneInterval?: number;
    startDate?: string; // YYYY-MM-DD — when to count intervals from
  };

  const { plantIds, startDate } = body;
  if (!Array.isArray(plantIds) || plantIds.length === 0) {
    return NextResponse.json({ error: "No plants specified" }, { status: 400 });
  }

  const update: {
    water_interval_days?: number | null;
    fertilize_interval_days?: number | null;
    repot_interval_days?: number | null;
    prune_interval_days?: number | null;
  } = {};

  if ("waterInterval"     in body) update.water_interval_days     = body.waterInterval     ?? null;
  if ("fertilizeInterval" in body) update.fertilize_interval_days = body.fertilizeInterval ?? null;
  if ("repotInterval"     in body) update.repot_interval_days     = body.repotInterval     ?? null;
  if ("pruneInterval"     in body) update.prune_interval_days     = body.pruneInterval     ?? null;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true });
  }

  // Update the intervals
  const { error } = await supabase
    .from("garden_plants")
    .update(update)
    .in("id", plantIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log a care event on startDate for each interval that was set, for each plant.
  // Only create events for past dates — today's date would auto-populate the
  // Completed section and make it look like care was already done today.
  if (startDate) {
    const todayStr = new Date().toISOString().split("T")[0];
    if (startDate < todayStr) {
      const intervalKeys = Object.keys(INTERVAL_TO_EVENT).filter((k) => k in body);
      if (intervalKeys.length > 0) {
        const events = plantIds.flatMap((plantId) =>
          intervalKeys.map((k) => ({
            plant_id:   plantId,
            user_id:    user.id,
            event_type: INTERVAL_TO_EVENT[k],
            event_date: startDate,
          }))
        );
        await supabase.from("garden_events").insert(events);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
