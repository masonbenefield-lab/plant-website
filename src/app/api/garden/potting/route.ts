import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_POTTING = ["pot", "ground"];

// Saves potting context onto a garden plant (My Garden is the source of truth).
// Used when the user notates it from the care-schedule suggest flow.
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plantId, potting, potSize } = await request.json() as {
    plantId: string; potting: string; potSize?: string | null;
  };

  if (!plantId || !VALID_POTTING.includes(potting)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  // potting/pot_size aren't in the generated types yet — update untyped. RLS
  // scopes the row to the owner, and we also pin user_id for defense in depth.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("garden_plants")
    .update({ potting, pot_size: potting === "pot" ? (potSize ?? null) : null })
    .eq("id", plantId)
    .eq("user_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
