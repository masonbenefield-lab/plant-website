import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId, title, body } = await request.json();
  if (!postId || !title?.trim()) return NextResponse.json({ error: "postId and title required" }, { status: 400 });

  // Verify ownership
  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post || post.user_id !== user.id) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const { error } = await supabase
    .from("community_posts")
    .update({ title: title.trim(), body: body?.trim() || null })
    .eq("id", postId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
