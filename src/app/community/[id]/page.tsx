import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { CommunityReplies } from "@/components/community/community-replies";
import { PostFollowButton } from "@/components/community/post-follow-button";
import ReportButton from "@/components/report-button";

const TYPE_LABEL = { help: "Help Request", show_and_tell: "Show & Tell", discussion: "Discussion" } as const;
const TYPE_COLOR = {
  help: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  show_and_tell: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  discussion: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
} as const;

type PostType = keyof typeof TYPE_LABEL;

export default async function CommunityPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { id } = await params;

  const [{ data: post }, { data: { user } }] = await Promise.all([
    supabase
      .from("community_posts")
      .select("id, user_id, post_type, title, body, photos, solved, created_at")
      .eq("id", id)
      .single(),
    supabase.auth.getUser(),
  ]);

  if (!post) notFound();

  const [{ data: author }, { data: replies }, { data: followRow }, { data: reportRow }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").eq("id", post.user_id).single(),
    supabase
      .from("community_replies")
      .select("id, user_id, body, photos, is_solution, created_at")
      .eq("post_id", id)
      .order("created_at", { ascending: true }),
    user
      ? supabase.from("community_post_follows").select("id").eq("user_id", user.id).eq("post_id", id).single()
      : Promise.resolve({ data: null }),
    user
      ? supabase.from("reports").select("id").eq("reporter_id", user.id).eq("community_post_id", id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const replyAuthorIds = [...new Set((replies ?? []).map((r) => r.user_id))];
  const { data: replyAuthors } = replyAuthorIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", replyAuthorIds)
    : { data: [] };
  const replyAuthorMap = Object.fromEntries((replyAuthors ?? []).map((a) => [a.id, a]));

  const isOwner = user?.id === post.user_id;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/community" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ChevronLeft size={16} />
        Community
      </Link>

      {/* Post */}
      <div className="rounded-xl border bg-card p-5 mb-8">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={cn("text-xs px-1.5 py-0 border-0", TYPE_COLOR[post.post_type as PostType])}>
              {TYPE_LABEL[post.post_type as PostType]}
            </Badge>
            {post.solved && (
              <span className="flex items-center gap-1 text-xs text-green-700 font-medium">
                <CheckCircle2 size={12} /> Solved
              </span>
            )}
          </div>
          <PostFollowButton postId={post.id} initialFollowing={!!followRow} size="md" />
        </div>
        <h1 className="text-xl font-bold mb-3">{post.title}</h1>
        {post.body && (
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground mb-4">{post.body}</p>
        )}
        {(post.photos as string[]).length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {(post.photos as string[]).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <div className="relative w-32 h-32 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                  <Image src={url} alt={`Post photo ${i + 1}`} fill className="object-cover" />
                </div>
              </a>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 pt-3 border-t">
          <Avatar className="h-7 w-7">
            <AvatarImage src={author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
              {author?.username?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <Link href={`/sellers/${author?.username}`} className="text-sm font-medium hover:underline">
            {author?.username}
          </Link>
          <span className="text-xs text-muted-foreground">
            {new Date(post.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
          {!isOwner && (
            <span className="ml-auto">
              <ReportButton
                userId={user?.id ?? null}
                communityPostId={post.id}
                targetName={post.title}
                initialReported={!!reportRow}
              />
            </span>
          )}
        </div>
      </div>

      {/* Replies */}
      <CommunityReplies
        postId={post.id}
        postType={post.post_type as PostType}
        postOwnerId={post.user_id}
        currentUserId={user?.id ?? null}
        solved={post.solved}
        initialReplies={(replies ?? []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          body: r.body,
          photos: r.photos as string[],
          is_solution: r.is_solution,
          created_at: r.created_at,
          username: replyAuthorMap[r.user_id]?.username ?? "unknown",
          avatar_url: replyAuthorMap[r.user_id]?.avatar_url ?? null,
        }))}
      />
    </div>
  );
}
