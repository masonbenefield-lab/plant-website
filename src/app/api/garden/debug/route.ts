import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  if (!username) return NextResponse.json({ error: "username required" });

  const admin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, username, garden_public")
    .eq("username", username)
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "profile not found", profileError });
  }

  const { data: plants, error: plantsError } = await admin
    .from("garden_plants")
    .select("id, name, is_public, user_id")
    .eq("user_id", profile.id);

  return NextResponse.json({
    profile_id: profile.id,
    garden_public: profile.garden_public,
    plants_count: plants?.length ?? 0,
    plants,
    plantsError,
  });
}
