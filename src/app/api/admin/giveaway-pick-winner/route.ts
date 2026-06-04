import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { month } = await req.json();
  if (!month) return NextResponse.json({ error: "Missing month" }, { status: 400 });

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all entries for this month
  const { data: entries } = await admin
    .from("giveaway_entries")
    .select("user_id")
    .eq("month", month);

  if (!entries || entries.length === 0) {
    return NextResponse.json({ error: "No entries for this month" }, { status: 400 });
  }

  const monthStart = `${month}-01T00:00:00.000Z`;
  const [year, mo] = month.split("-").map(Number);
  const monthEnd = new Date(year, mo, 1).toISOString(); // first day of next month

  // Fetch referral activations for this month in one query
  const userIds = entries.map((e) => e.user_id);
  const { data: activations } = await admin
    .from("referral_activations")
    .select("referrer_id, type")
    .in("referrer_id", userIds)
    .gte("activated_at", monthStart)
    .lt("activated_at", monthEnd);

  // Count activations per user by type (plant_added=+1, first_sale=+2)
  const plantAddedCounts: Record<string, number> = {};
  const firstSaleCounts: Record<string, number> = {};
  for (const a of activations ?? []) {
    if (a.type === "first_sale") {
      firstSaleCounts[a.referrer_id] = (firstSaleCounts[a.referrer_id] ?? 0) + 1;
    } else {
      plantAddedCounts[a.referrer_id] = (plantAddedCounts[a.referrer_id] ?? 0) + 1;
    }
  }

  // Build weighted pool
  const pool: string[] = [];
  for (const entry of entries) {
    const bonus = (plantAddedCounts[entry.user_id] ?? 0) + (firstSaleCounts[entry.user_id] ?? 0) * 2;
    const weight = 1 + bonus;
    for (let i = 0; i < weight; i++) pool.push(entry.user_id);
  }

  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // Pick 6 unique users (winner + 5 backups)
  const picked: string[] = [];
  for (const id of pool) {
    if (!picked.includes(id)) picked.push(id);
    if (picked.length === 6) break;
  }

  // Fetch profiles for picked users
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .in("id", picked);

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const results = picked.map((id, index) => {
    const plantBonus = plantAddedCounts[id] ?? 0;
    const saleBonus = (firstSaleCounts[id] ?? 0) * 2;
    return {
      rank: index, // 0 = winner, 1-5 = backups
      user_id: id,
      username: profileMap[id]?.username ?? "unknown",
      display_name: profileMap[id]?.display_name ?? null,
      avatar_url: profileMap[id]?.avatar_url ?? null,
      base_entries: 1,
      bonus_entries: plantBonus + saleBonus,
      total_entries: 1 + plantBonus + saleBonus,
      total_pool: pool.length,
    };
  });

  return NextResponse.json({ results, total_entrants: entries.length, total_pool: pool.length });
}
