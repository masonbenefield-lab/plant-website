import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { replyId } = await request.json();
  if (!replyId) return NextResponse.json({ error: "replyId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("community_reply_likes")
    .select("id")
    .eq("user_id", user.id)
    .eq("reply_id", replyId)
    .maybeSingle();

  if (existing) {
    await supabase.from("community_reply_likes").delete().eq("user_id", user.id).eq("reply_id", replyId);
    return NextResponse.json({ liked: false });
  }

  await supabase.from("community_reply_likes").insert({ user_id: user.id, reply_id: replyId });
  return NextResponse.json({ liked: true });
}
