import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendDailyAdminDigest } from "@/lib/email";

export const maxDuration = 60;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const month = now.toISOString().slice(0, 7);
  const dateLabel = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  const [
    { count: newUsers },
    { count: totalUsers },
    { count: newGiveawayEntries },
    { count: totalGiveawayEntries },
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("giveaway_entries").select("*", { count: "exact", head: true }).gte("created_at", since),
    admin.from("giveaway_entries").select("*", { count: "exact", head: true }).eq("month", month),
  ]);

  await sendDailyAdminDigest({
    newUsers: newUsers ?? 0,
    totalUsers: totalUsers ?? 0,
    newGiveawayEntries: newGiveawayEntries ?? 0,
    totalGiveawayEntries: totalGiveawayEntries ?? 0,
    dateLabel,
  });

  return NextResponse.json({ ok: true, newUsers, newGiveawayEntries });
}
