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
    waterInterval?: number | null;
    fertilizeInterval?: number | null;
    repotInterval?: number | null;
    pruneInterval?: number | null;
    startDate?: string;
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

  // Create a baseline event so the task first appears ON startDate (not after it).
  // We store a "last done" event `interval` days before startDate so that
  // nextDue = startDate exactly. Skip today — the plant will show as due today
  // and the user logs it themselves, avoiding a false auto-complete.
  if (startDate) {
    const d = new Date();
    const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    if (startDate !== todayStr) {
      const startLocal = new Date(startDate + "T00:00:00");

      // Only create events for intervals that were explicitly set to a value >= 1
      const intervalKeys = Object.keys(INTERVAL_TO_EVENT).filter((k) => {
        const val = (body as Record<string, unknown>)[k];
        return typeof val === "number" && val >= 1;
      });

      if (intervalKeys.length > 0) {
        const events = plantIds.flatMap((plantId) =>
          intervalKeys.map((k) => {
            const intervalVal = (body as Record<string, unknown>)[k] as number;
            // Compute the "last done" date as startDate - interval
            const lastDone = new Date(startLocal.getTime() - intervalVal * 86400000);
            const y = lastDone.getFullYear();
            const m = String(lastDone.getMonth() + 1).padStart(2, "0");
            const day = String(lastDone.getDate()).padStart(2, "0");
            return {
              plant_id:   plantId,
              user_id:    user.id,
              event_type: INTERVAL_TO_EVENT[k],
              event_date: `${y}-${m}-${day}`,
            };
          })
        );
        await supabase.from("garden_events").insert(events);
      }
    }
  }

  return NextResponse.json({ ok: true });
}
