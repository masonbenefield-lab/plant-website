import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);

  const supabase = await createClient();

  const { data: onboardedSellers } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_onboarded", true)
    .is("deleted_at", null);
  const onboardedIds = onboardedSellers?.map((s) => s.id) ?? [];

  const { data } = await supabase
    .from("listings")
    .select("plant_name, variety")
    .or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`)
    .or("category.neq.Hidden,category.is.null")
    .eq("status", "active")
    .in("seller_id", onboardedIds.length ? onboardedIds : ["00000000-0000-0000-0000-000000000000"])
    .limit(20);

  // Build deduplicated list of suggestions
  const seen = new Set<string>();
  const suggestions: string[] = [];

  for (const row of data ?? []) {
    const name = row.plant_name;
    const full = row.variety ? `${row.plant_name} — ${row.variety}` : row.plant_name;
    if (!seen.has(name)) { seen.add(name); suggestions.push(name); }
    if (row.variety && !seen.has(full)) { seen.add(full); suggestions.push(full); }
    if (suggestions.length >= 8) break;
  }

  return NextResponse.json(suggestions);
}
