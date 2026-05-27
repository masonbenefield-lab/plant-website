import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { sendGardenCareReminder } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Garden care reminder emails are disabled — intervals are for personal tracking only
  return NextResponse.json({ sent: 0, disabled: true });

  const supabase = adminClient();
  const month = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // Get all users with plants that have at least one interval set
  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, user_id, name, variety, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
    .or("water_interval_days.not.is.null,fertilize_interval_days.not.is.null,repot_interval_days.not.is.null,prune_interval_days.not.is.null");

  if (!plants?.length) return NextResponse.json({ sent: 0 });

  // Get last events for all these plants
  const plantIds = (plants ?? []).map((p) => p.id);
  const { data: lastEvents } = await supabase
    .from("garden_events")
    .select("plant_id, event_type, event_date")
    .in("plant_id", plantIds)
    .in("event_type", ["watered", "fertilized", "repotted", "pruned"])
    .order("event_date", { ascending: false });

  const lastEventMap: Record<string, Record<string, Date>> = {};
  for (const ev of lastEvents ?? []) {
    if (!lastEventMap[ev.plant_id]) lastEventMap[ev.plant_id] = {};
    if (!lastEventMap[ev.plant_id][ev.event_type]) {
      lastEventMap[ev.plant_id][ev.event_type] = new Date(ev.event_date);
    }
  }

  // Group plants by user
  const byUser: Record<string, NonNullable<typeof plants>> = {};
  for (const plant of (plants ?? [])) {
    if (!byUser[plant.user_id]) byUser[plant.user_id] = [];
    byUser[plant.user_id].push(plant);
  }

  const userIds = Object.keys(byUser);
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, email_marketing_opt_in")
    .in("id", userIds);

  // Get emails from auth.users
  const emailResults = await Promise.all(
    userIds.map((uid) => supabase.auth.admin.getUserById(uid))
  );
  const emailMap: Record<string, string> = {};
  for (const { data } of emailResults) {
    if (data?.user?.email) emailMap[data.user.id] = data.user.email;
  }

  const today = new Date();
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let sent = 0;

  for (const profile of profiles ?? []) {
    if (!profile.email_marketing_opt_in) continue;
    const email = emailMap[profile.id];
    if (!email) continue;

    const userPlants = byUser[profile.id] ?? [];
    const items: { plantName: string; careType: string; nextDueDate: string }[] = [];

    for (const plant of userPlants) {
      const checks = [
        { type: "Water",     interval: plant.water_interval_days,     eventKey: "watered" },
        { type: "Fertilize", interval: plant.fertilize_interval_days, eventKey: "fertilized" },
        { type: "Repot",     interval: plant.repot_interval_days,     eventKey: "repotted" },
        { type: "Prune",     interval: plant.prune_interval_days,     eventKey: "pruned" },
      ];

      for (const { type, interval, eventKey } of checks) {
        if (!interval) continue;
        const last = lastEventMap[plant.id]?.[eventKey];
        const nextDue = last
          ? new Date(last.getTime() + interval * 86400000)
          : today;

        // Include if next due date falls within this month
        if (nextDue <= monthEnd) {
          const plantName = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;
          items.push({
            plantName,
            careType: type,
            nextDueDate: nextDue <= today
              ? "Overdue"
              : nextDue.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          });
        }
      }
    }

    if (!items.length) continue;

    try {
      await sendGardenCareReminder({
        recipientEmail: email,
        username: profile.username,
        userId: profile.id,
        month,
        items,
      });
      sent++;
    } catch {
      // continue on individual failures
    }
  }

  return NextResponse.json({ sent });
}
