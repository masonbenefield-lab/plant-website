import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId } = await req.json();
  if (!plantId) return NextResponse.json({ error: "plantId required" }, { status: 400 });

  // Verify ownership
  const { data: plant } = await supabase
    .from("garden_plants")
    .select("id, pin_order")
    .eq("id", plantId)
    .eq("user_id", user.id)
    .single();

  if (!plant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If already pinned — unpin
  if (plant.pin_order !== null) {
    await supabase.from("garden_plants").update({ pin_order: null }).eq("id", plantId);
    return NextResponse.json({ pinOrder: null });
  }

  // Find next available slot (1–4)
  const { data: pinned } = await supabase
    .from("garden_plants")
    .select("pin_order")
    .eq("user_id", user.id)
    .not("pin_order", "is", null);

  const used = new Set((pinned ?? []).map((p) => p.pin_order));
  const nextSlot = [1, 2, 3, 4].find((n) => !used.has(n));

  if (!nextSlot) {
    return NextResponse.json({ error: "You already have 4 pinned plants. Unpin one first." }, { status: 400 });
  }

  await supabase.from("garden_plants").update({ pin_order: nextSlot }).eq("id", plantId);
  return NextResponse.json({ pinOrder: nextSlot });
}
