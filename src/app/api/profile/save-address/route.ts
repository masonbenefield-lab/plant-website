import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { address } = await request.json();
  if (!address?.name || !address?.line1) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  await supabase.from("profiles").update({ saved_shipping_address: address }).eq("id", user.id);
  return NextResponse.json({ success: true });
}
