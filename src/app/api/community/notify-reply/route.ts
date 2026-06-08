import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { sendCommunityReplyNotification } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false });

  const { postId, replyBody } = await request.json();
  if (!postId || !replyBody) return NextResponse.json({ ok: false });

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: post } = await supabase
    .from("community_posts")
    .select("title, user_id")
    .eq("id", postId)
    .single();

  if (!post) return NextResponse.json({ ok: false });

  // Don't notify if the post author is replying to their own post
  if (post.user_id === user.id) return NextResponse.json({ ok: true, skipped: "own post" });

  const [{ data: replierProfile }, { data: { user: postAuthor } }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    admin.auth.admin.getUserById(post.user_id),
  ]);

  if (!postAuthor?.email) return NextResponse.json({ ok: false });

  const snippet = replyBody.length > 200 ? replyBody.slice(0, 200) + "…" : replyBody;

  await sendCommunityReplyNotification({
    toEmail: postAuthor.email,
    postTitle: post.title,
    postId,
    replierUsername: replierProfile?.username ?? "Someone",
    replySnippet: snippet,
  }).catch(() => {});

  return NextResponse.json({ ok: true });
}
