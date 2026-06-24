import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import Image from "next/image";
import { PrintButton } from "./print-button";
import { AutoPrint } from "./auto-print";
import { todayStrInTz } from "@/lib/care-date";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHECKS = [
  { type: "Water",     eventKey: "watered",    intervalKey: "water_interval_days",     emoji: "💧" },
  { type: "Fertilize", eventKey: "fertilized", intervalKey: "fertilize_interval_days", emoji: "🌿" },
  { type: "Repot",     eventKey: "repotted",   intervalKey: "repot_interval_days",     emoji: "🪴" },
  { type: "Prune",     eventKey: "pruned",      intervalKey: "prune_interval_days",     emoji: "✂️" },
] as const;

type SitterTask = { plantName: string; careType: string; emoji: string };

export default async function SitterGuidePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; days?: string; pdf?: string }>;
}) {
  const params = await searchParams;
  const token = params.token;
  if (!token) redirect("/");

  const autoPrint = params.pdf === "1";

  const { data: profile } = await admin
    .from("profiles")
    .select("id, username, timezone")
    .eq("sitter_token", token)
    .single();

  if (!profile) redirect("/");

  const [{ data: plants }, { data: customSchedules }] = await Promise.all([
    admin.from("garden_plants")
      .select("id, name, variety, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days")
      .eq("user_id", profile.id).order("name"),
    admin.from("custom_care_schedules")
      .select("id, plant_id, label, interval_days")
      .eq("user_id", profile.id),
  ]);

  const plantList = (plants ?? []).filter((p) =>
    p.water_interval_days || p.fertilize_interval_days || p.repot_interval_days || p.prune_interval_days ||
    (customSchedules ?? []).some((cs) => cs.plant_id === p.id)
  );
  const plantIds = plantList.map((p) => p.id);

  const { data: lastEvents } = plantIds.length
    ? await admin
        .from("garden_events")
        .select("plant_id, event_type, event_date")
        .in("plant_id", plantIds)
        .order("event_date", { ascending: false })
    : { data: [] };

  const lastEventMap: Record<string, Record<string, string>> = {};
  for (const ev of lastEvents ?? []) {
    if (!lastEventMap[ev.plant_id]) lastEventMap[ev.plant_id] = {};
    if (!lastEventMap[ev.plant_id][ev.event_type]) {
      lastEventMap[ev.plant_id][ev.event_type] = ev.event_date;
    }
  }

  const parsedDays = parseInt(params.days ?? "30", 10);
  const daysAhead = Number.isNaN(parsedDays) ? 30 : Math.min(90, Math.max(7, parsedDays));
  const today = new Date(todayStrInTz(profile.timezone ?? null) + "T00:00:00");
  today.setHours(0, 0, 0, 0);

  const schedule = new Map<number, SitterTask[]>();

  for (const plant of plantList) {
    const plantName = plant.variety ? `${plant.name} — ${plant.variety}` : plant.name;

    for (const { type, eventKey, intervalKey, emoji } of CHECKS) {
      const interval = (plant as Record<string, unknown>)[intervalKey] as number | null;
      if (!interval) continue;

      const lastDateStr = lastEventMap[plant.id]?.[eventKey] ?? null;
      let daysUntilDue: number;
      if (lastDateStr) {
        const last = new Date(lastDateStr + "T00:00:00");
        last.setHours(0, 0, 0, 0);
        const nextDue = new Date(last.getTime() + interval * 86400000);
        daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
      } else {
        daysUntilDue = 0;
      }

      let d = daysUntilDue;
      if (d < 0) d += Math.ceil(Math.abs(d) / interval) * interval;
      while (d < daysAhead) {
        if (!schedule.has(d)) schedule.set(d, []);
        schedule.get(d)!.push({ plantName, careType: type, emoji });
        d += interval;
      }
    }

    // Custom schedules for this plant
    for (const cs of (customSchedules ?? []).filter((s) => s.plant_id === plant.id)) {
      const eventType = `custom:${cs.id}`;
      const lastDateStr = lastEventMap[plant.id]?.[eventType] ?? null;
      let daysUntilDue: number;
      if (lastDateStr) {
        const last = new Date(lastDateStr + "T00:00:00");
        last.setHours(0, 0, 0, 0);
        const nextDue = new Date(last.getTime() + cs.interval_days * 86400000);
        daysUntilDue = Math.round((nextDue.getTime() - today.getTime()) / 86400000);
      } else {
        daysUntilDue = 0;
      }
      let d = daysUntilDue;
      if (d < 0) d += Math.ceil(Math.abs(d) / cs.interval_days) * cs.interval_days;
      while (d < daysAhead) {
        if (!schedule.has(d)) schedule.set(d, []);
        schedule.get(d)!.push({ plantName, careType: cs.label, emoji: "✨" });
        d += cs.interval_days;
      }
    }
  }

  const scheduleDays = [...schedule.keys()].sort((a, b) => a - b);
  const rangeEnd = new Date(today.getTime() + daysAhead * 86400000);
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-US", opts);

  return (
    <>
      {/* Kill browser print chrome (URL, date, page numbers) and hide site nav/footer */}
      <style>{`
        @page { margin: 0; }
        @media print {
          header, footer { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-wrap { padding: 0.65in; }
          body, body * { color: #111111 !important; }
          .print-muted { color: #555555 !important; }
        }
      `}</style>

      {autoPrint && <AutoPrint />}

      <div className="print-wrap max-w-2xl mx-auto px-4 py-8">

        {/* Branded header — print only */}
        <div className="hidden print:flex items-center justify-between mb-6 pb-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Image src="/plantet-mark-color.svg" alt="Plantet" width={22} height={22} />
            <span className="font-bold text-lg tracking-tight">Plantet</span>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold">{profile.username}&apos;s Plant Care Schedule</p>
            <p className="text-xs text-gray-500">
              {fmt(today, { month: "short", day: "numeric" })} – {fmt(rangeEnd, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Screen header */}
        <div className="print:hidden mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">🌿 Plant Care Schedule</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {profile.username}&apos;s plants · {fmt(today, { month: "short", day: "numeric" })} – {fmt(rangeEnd, { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <PrintButton />
        </div>

        {scheduleDays.length === 0 ? (
          <div className="rounded-xl border bg-muted/30 text-center py-16">
            <p className="text-3xl mb-2">✅</p>
            <p className="font-semibold">No care tasks in the next {daysAhead} days</p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduleDays.map((dayOffset) => {
              const date = new Date(today.getTime() + dayOffset * 86400000);
              const tasks = schedule.get(dayOffset)!;
              const isToday = dayOffset === 0;

              return (
                <div key={dayOffset} className="border rounded-lg overflow-hidden print:break-inside-avoid">
                  <div className="bg-muted/50 print:bg-gray-100 px-4 py-2 border-b">
                    <h2 className="font-semibold text-sm">
                      {isToday && <span className="text-amber-600 mr-1">Today — </span>}
                      {fmt(date, { weekday: "long", month: "long", day: "numeric" })}
                    </h2>
                  </div>
                  <div className="divide-y">
                    {tasks.map((task, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-3">
                        <span className="text-base shrink-0">{task.emoji}</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{task.plantName}</p>
                          <p className="text-xs text-muted-foreground print-muted">{task.careType}</p>
                        </div>
                        <div className="ml-auto w-5 h-5 rounded border-2 border-muted-foreground/40 print:border-gray-400 shrink-0" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="mt-8 text-xs text-muted-foreground print-muted text-center">
          plantet.shop · View-only link
        </p>
      </div>
    </>
  );
}
