import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Partial profile update for just the seller's shipping timeline + return policy.
// Kept separate from /api/profile/update, which overwrites the whole profile row.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shipping_days, shipping_days_max, return_policy_type, return_policy_notes } = await request.json() as {
    shipping_days?: number | null;
    shipping_days_max?: number | null;
    return_policy_type?: string | null;
    return_policy_notes?: string | null;
  };

  const { error } = await supabase
    .from("profiles")
    .update({
      shipping_days: shipping_days ?? null,
      shipping_days_max: shipping_days_max ?? null,
      return_policy_type: return_policy_type ?? null,
      return_policy_notes: return_policy_notes ?? null,
    } as never)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
