import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAddress } from "@/lib/shippo";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, street1, city, state, zip, country, phone } = body;
  if (!street1 || !city || !state || !zip) {
    return NextResponse.json({ error: "Address incomplete" }, { status: 400 });
  }

  try {
    const result = await validateAddress({ name: name ?? "", street1, city, state, zip, country: country || "US", phone });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
