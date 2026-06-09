import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  let listingQuery = admin
    .from("listings")
    .select("plant_name")
    .eq("status", "active")
    .limit(150);
  if (q) listingQuery = listingQuery.ilike("plant_name", `%${q}%`);

  let tagQuery = admin
    .from("community_posts")
    .select("plant_tag")
    .not("plant_tag", "is", null)
    .limit(200);
  if (q) tagQuery = tagQuery.ilike("plant_tag", `%${q}%`);

  const [{ data: listings }, { data: tags }] = await Promise.all([listingQuery, tagQuery]);

  const names = new Set<string>();
  for (const l of listings ?? []) if (l.plant_name) names.add(l.plant_name);
  for (const t of tags ?? []) if (t.plant_tag) names.add(t.plant_tag);

  const lowerQ = q.toLowerCase();
  const results = [...names]
    .filter((n) => !q || n.toLowerCase().includes(lowerQ))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, 20);

  return NextResponse.json({ suggestions: results });
}
