import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push";
import { hourInTz } from "@/lib/care-date";
import { getOvernightLowF } from "@/lib/weather";

export const maxDuration = 300;

// Runs hourly. In each opted-in user's early evening, checks tonight's forecast
// low for their ZIP and pushes a frost warning so they can protect outdoor
// plants. Advisory only — it never changes the care schedule.
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FROST_HOUR = 17;        // 5pm local — time to act before overnight
const FROST_THRESHOLD_F = 36; // frost can form at/around this under clear, calm skies

type Row = { id: string; timezone: string | null; lat: number | null; lng: number | null };

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, timezone, lat, lng")
    .eq("frost_alerts", true)
    .not("lat", "is", null);

  if (!profiles?.length) return NextResponse.json({ sent: 0, reason: "None eligible" });

  const eligible = (profiles as Row[]).filter(
    (p) => p.lat != null && p.lng != null && hourInTz(p.timezone) === FROST_HOUR
  );
  if (!eligible.length) return NextResponse.json({ sent: 0, reason: "Nobody in the evening window" });

  let sent = 0;
  for (const p of eligible) {
    const low = await getOvernightLowF(p.lat as number, p.lng as number);
    if (low == null || low > FROST_THRESHOLD_F) continue;
    await sendPushToUser(
      p.id,
      "❄️ Frost alert tonight",
      `Low of ${Math.round(low)}°F forecast — protect your outdoor plants.`,
      { url: "/garden" }
    );
    sent++;
  }

  return NextResponse.json({ sent, eligible: eligible.length });
}
