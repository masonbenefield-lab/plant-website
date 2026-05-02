import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { word, context, snippet } = body;
  if (!word || !context) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await supabase.from("word_violations").insert({
    user_id: user.id,
    word: String(word).slice(0, 100),
    context: String(context).slice(0, 80),
    content_snippet: snippet ? String(snippet).slice(0, 120) : null,
  });

  return NextResponse.json({ ok: true });
}
