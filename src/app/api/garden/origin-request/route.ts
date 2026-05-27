import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plant_id, verifier_user_id } = await req.json() as { plant_id: string; verifier_user_id: string };
  if (!plant_id || !verifier_user_id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  if (verifier_user_id === user.id) return NextResponse.json({ error: "Cannot verify your own plant" }, { status: 400 });

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Verify the plant belongs to the requester
  const { data: plant } = await admin
    .from("garden_plants")
    .select("id, name, variety")
    .eq("id", plant_id)
    .eq("user_id", user.id)
    .single();

  if (!plant) return NextResponse.json({ error: "Plant not found" }, { status: 404 });

  // Get the requester's username
  const { data: requesterProfile } = await admin
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  if (!requesterProfile?.username) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const plantName = plant.variety ? `${plant.variety} (${plant.name})` : plant.name;

  // Delete any existing request for this plant, then insert fresh
  await admin.from("plant_origin_requests").delete().eq("plant_id", plant_id);

  await admin.from("plant_origin_requests").insert({
    plant_id,
    requester_id: user.id,
    verifier_user_id,
    plant_name: plantName,
    requester_username: requesterProfile.username,
    status: "pending",
  });

  // Reset verification on the plant
  await admin.from("garden_plants").update({ origin_verified: false }).eq("id", plant_id);

  return NextResponse.json({ ok: true });
}
