import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ship_from_address, shipping_services, calculated_shipping_enabled, auto_labels_enabled } = await request.json() as {
    ship_from_address: { name: string; street1: string; city: string; state: string; zip: string; country: string; phone?: string } | null;
    shipping_services: string[] | null;
    calculated_shipping_enabled?: boolean;
    auto_labels_enabled?: boolean;
  };

  const updatePayload: ProfileUpdate = {
    ship_from_address: ship_from_address ?? null,
    shipping_services: shipping_services ?? null,
    ...(calculated_shipping_enabled !== undefined ? { calculated_shipping_enabled } : {}),
    ...(auto_labels_enabled !== undefined ? { auto_labels_enabled } : {}),
  };

  const { error } = await supabase
    .from("profiles")
    .update(updatePayload)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
