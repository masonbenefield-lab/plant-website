import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { country } = await req.json() as { country: string };
  if (!country) return NextResponse.json({ error: "Missing country" }, { status: 400 });

  await supabase.from("profiles").update({ country }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
