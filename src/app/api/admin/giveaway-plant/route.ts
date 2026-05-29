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

  const { month, plant_name, description, image_url } = await req.json();
  if (!month) return NextResponse.json({ error: "month required" }, { status: 400 });
  if (!plant_name?.trim()) return NextResponse.json({ error: "plant_name required" }, { status: 400 });

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await admin
    .from("giveaway_months")
    .upsert({
      month,
      plant_name: plant_name.trim(),
      description: description?.trim() || null,
      image_url: image_url || null,
    }, { onConflict: "month", ignoreDuplicates: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
