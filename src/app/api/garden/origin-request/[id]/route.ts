import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await req.json() as { action: "confirm" | "deny" };
  if (action !== "confirm" && action !== "deny") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: request } = await admin
    .from("plant_origin_requests")
    .select("id, plant_id, verifier_user_id, status")
    .eq("id", id)
    .single();

  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.verifier_user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (request.status !== "pending") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  if (action === "confirm") {
    await Promise.all([
      admin.from("plant_origin_requests").update({ status: "confirmed" }).eq("id", id),
      admin.from("garden_plants").update({ origin_verified: true }).eq("id", request.plant_id),
    ]);
  } else {
    // deny: just mark denied — plant keeps from_user_id privately, origin_verified stays false
    await admin.from("plant_origin_requests").update({ status: "denied" }).eq("id", id);
  }

  return NextResponse.json({ ok: true });
}
