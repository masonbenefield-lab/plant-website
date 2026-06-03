import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
  };

  const { plantIds } = body;
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

  const { error } = await supabase
    .from("garden_plants")
    .update(update)
    .in("id", plantIds)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
