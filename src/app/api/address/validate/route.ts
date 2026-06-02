import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validateAddress } from "@/lib/shippo";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, line1, city, state, zip, country } = await request.json();

  try {
    const result = await validateAddress({
      name: name ?? "",
      street1: line1 ?? "",
      city: city ?? "",
      state: state ?? "",
      zip: zip ?? "",
      country: country ?? "US",
    });
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ valid: true, messages: [] });
  }
}
