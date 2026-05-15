import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MessageCircle, CheckCircle2 } from "lucide-react";
import { CommunitySearchBar } from "@/components/community-search-bar";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { help: "Help Request", show_and_tell: "Show & Tell", discussion: "Discussion" } as const;
const TYPE_COLOR = {
  help: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  show_and_tell: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  discussion: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
} as const;

type PostType = "help" | "show_and_tell" | "discussion";

function buildHref(params: { type?: string; sort?: string; q?: string }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.type) p.set("type", params.type);
  if (params.sort && params.sort !== "newest") p.set("sort", params.sort);
  const s = p.toString();
  return s ? `/community?${s}` : "/community";
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { type, sort, q } = await searchParams;
  const validType = (["help", "show_and_tell", "discussion"] as const).find((t) => t === type);
  const validSort = (["newest", "most_replies", "unanswered"] as const).find((s) => s === sort) ?? "newest";
  const searchQuery = q?.trim() ?? "";

  let query = supabase
    .from("community_posts")
    .select("id, user_id, post_type, title, body, photos, solved, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (validType) query = query.eq("post_type", validType);
  if (searchQuery) query = query.or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`);
  if (validSort === "unanswered") query = query.eq("post_type", validType ?? "help");

  const { data: rawPosts } = await query;

  const authorIds = [...new Set((rawPosts ?? []).map((p) => p.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors ?? []).map((a) => [a.id, a]));

  const postIds = (rawPosts ?? []).map((p) => p.id);
  const { data: replyCounts } = postIds.length
    ? await supabase.from("community_replies").select("post_id").in("post_id", postIds)
    : { data: [] };
  const replyCountMap: Record<string, number> = {};
  for (const r of replyCounts ?? []) {
    replyCountMap[r.post_id] = (replyCountMap[r.post_id] ?? 0) + 1;
  }

  // Apply client-side sort / filter after reply counts are known
  let posts = [...(rawPosts ?? [])];
  if (validSort === "most_replies") {
    posts.sort((a, b) => (replyCountMap[b.id] ?? 0) - (replyCountMap[a.id] ?? 0));
  } else if (validSort === "unanswered") {
    posts = posts.filter((p) => p.post_type === "help" && (replyCountMap[p.id] ?? 0) === 0);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Ask questions, share plants, and connect with other growers</p>
        </div>
        <Link href="/community/new" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
          + New Post
        </Link>
      </div>

      {/* Search */}
      <Suspense>
        <CommunitySearchBar />
      </Suspense>

      {/* Type filter tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        <FilterChip href={buildHref({ sort: validSort, q: searchQuery })} label="All" active={!validType} />
        <FilterChip href={buildHref({ type: "help", sort: validSort, q: searchQuery })} label="Help Requests" active={validType === "help"} />
        <FilterChip href={buildHref({ type: "show_and_tell", sort: validSort, q: searchQuery })} label="Show & Tell" active={validType === "show_and_tell"} />
        <FilterChip href={buildHref({ type: "discussion", sort: validSort, q: searchQuery })} label="Discussions" active={validType === "discussion"} />
      </div>
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip href={buildHref({ type: validType, q: searchQuery })} label="Newest" active={validSort === "newest"} small />
        <FilterChip href={buildHref({ type: validType, sort: "most_replies", q: searchQuery })} label="Most Replies" active={validSort === "most_replies"} small />
        <FilterChip href={buildHref({ type: validType, sort: "unanswered", q: searchQuery })} label="Unanswered" active={validSort === "unanswered"} small />
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">🌿</p>
          {searchQuery ? (
            <>
              <p className="font-semibold mb-1">No posts match &ldquo;{searchQuery}&rdquo;</p>
              <p className="text-sm text-muted-foreground mb-4">Try a different search term or clear the search.</p>
              <Link href={buildHref({ type: validType, sort: validSort })} className="text-sm text-green-700 hover:underline">Clear search</Link>
            </>
          ) : (
            <>
              <p className="font-semibold mb-1">Nothing here yet</p>
              <p className="text-sm text-muted-foreground mb-6">Be the first to post in the community.</p>
              <Link href="/community/new" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
                Post something
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {(posts ?? []).map((post) => {
            const author = authorMap[post.user_id];
            const replyCount = replyCountMap[post.id] ?? 0;
            return (
              <Link
                key={post.id}
                href={`/community/${post.id}`}
                className="block rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                    <AvatarImage src={author?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
                      {author?.username?.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge className={cn("text-xs px-1.5 py-0 border-0", TYPE_COLOR[post.post_type as PostType])}>
                        {TYPE_LABEL[post.post_type as PostType]}
                      </Badge>
                      {post.solved && (
                        <span className="flex items-center gap-0.5 text-xs text-green-700 font-medium">
                          <CheckCircle2 size={12} /> Solved
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-sm leading-snug line-clamp-2">{post.title}</p>
                    {post.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{post.body}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{author?.username}</span>
                      <span>{new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                      <span className="flex items-center gap-1">
                        <MessageCircle size={11} /> {replyCount} {replyCount === 1 ? "reply" : "replies"}
                      </span>
                    </div>
                  </div>
                  {(post.photos as string[]).length > 0 && (
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden border shrink-0 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={(post.photos as string[])[0]} alt="Post photo" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, label, active, small }: { href: string; label: string; active: boolean; small?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full font-medium transition-colors border",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        active
          ? "bg-green-700 text-white border-green-700"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-green-400"
      )}
    >
      {label}
    </Link>
  );
}
