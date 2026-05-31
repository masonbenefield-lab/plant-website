import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { field, url } = await request.json() as { field: string; url: string };

  if (field !== "avatar_url" && field !== "banner_url") {
    return NextResponse.json({ error: "Invalid field" }, { status: 400 });
  }

  const update = field === "avatar_url" ? { avatar_url: url } : { banner_url: url };
  const { error } = await supabase.from("profiles").update(update).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
