import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { postId } = await request.json() as { postId: string };
  if (!postId) return NextResponse.json({ error: "Missing postId" }, { status: 400 });

  const { data: post } = await supabase
    .from("community_posts")
    .select("user_id")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await supabase.from("community_posts").delete().eq("id", postId);

  return NextResponse.json({ ok: true });
}
