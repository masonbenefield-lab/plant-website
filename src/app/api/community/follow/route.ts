import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await request.json();
  if (!postId) return NextResponse.json({ error: "postId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("community_post_follows")
    .select("id")
    .eq("user_id", user.id)
    .eq("post_id", postId)
    .single();

  if (existing) {
    await supabase.from("community_post_follows").delete().eq("id", existing.id);
    return NextResponse.json({ following: false });
  }

  await supabase.from("community_post_follows").insert({ user_id: user.id, post_id: postId });
  return NextResponse.json({ following: true });
}
