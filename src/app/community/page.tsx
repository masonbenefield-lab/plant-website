import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MessageCircle, CheckCircle2, Bookmark } from "lucide-react";
import { CommunitySearchBar } from "@/components/community-search-bar";
import { PostFollowButton } from "@/components/community/post-follow-button";
import CommunityGardensGrid from "@/components/garden/community-gardens-grid";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { help: "Help Request", show_and_tell: "Show & Tell", discussion: "Discussion" } as const;
const TYPE_COLOR = {
  help: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  show_and_tell: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  discussion: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
} as const;

type PostType = "help" | "show_and_tell" | "discussion";

function buildHref(params: { type?: string; sort?: string; q?: string; view?: string }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.view) p.set("view", params.view);
  if (!params.view) {
    if (params.type) p.set("type", params.type);
    if (params.sort && params.sort !== "newest") p.set("sort", params.sort);
  }
  const s = p.toString();
  return s ? `/community?${s}` : "/community";
}

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string; view?: string }>;
}) {
  const supabase = await createClient();
  const { type, sort, q, view } = await searchParams;
  const { data: { user } } = await supabase.auth.getUser();

  const isSavedView = view === "saved";
  const isGardensView = view === "gardens";
  const validType = (["help", "show_and_tell", "discussion"] as const).find((t) => t === type);
  const validSort = (["newest", "most_replies", "unanswered"] as const).find((s) => s === sort) ?? "newest";
  const searchQuery = q?.trim() ?? "";

  // Gardens view data
  type GardenProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null; garden_bio: string | null; open_to_trades: boolean };
  type GardenSummary = { count: number; photos: string[] };
  let gardens: GardenProfile[] = [];
  let gardenMap: Record<string, GardenSummary> = {};

  if (isGardensView) {
    const admin = createAdminClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name, avatar_url, garden_bio, open_to_trades")
      .eq("garden_public", true)
      .is("deleted_at", null)
      .order("username");
    const profileIds = profiles?.map((p) => p.id) ?? [];
    const { data: plants } = profileIds.length
      ? await admin
          .from("garden_plants")
          .select("user_id, images, pin_order, name")
          .in("user_id", profileIds)
          .or("is_public.eq.true,is_public.is.null")
          .order("pin_order", { ascending: true, nullsFirst: false })
      : { data: [] };
    for (const plant of plants ?? []) {
      if (!gardenMap[plant.user_id]) gardenMap[plant.user_id] = { count: 0, photos: [] };
      gardenMap[plant.user_id].count++;
      if (gardenMap[plant.user_id].photos.length < 4 && plant.images?.[0]) {
        gardenMap[plant.user_id].photos.push(plant.images[0]);
      }
    }
    gardens = (profiles ?? []).filter((p) => (gardenMap[p.id]?.count ?? 0) > 0);
  }

  let posts: { id: string; user_id: string; post_type: string; title: string; body: string | null; photos: unknown; solved: boolean; created_at: string }[] = [];

  if (isSavedView) {
    if (user) {
      const { data: follows } = await supabase
        .from("community_post_follows")
        .select("post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const followedIds = (follows ?? []).map((f) => f.post_id);
      if (followedIds.length) {
        const { data } = await supabase
          .from("community_posts")
          .select("id, user_id, post_type, title, body, photos, solved, created_at")
          .in("id", followedIds);
        // preserve order from follows (most recently saved first)
        const orderMap = Object.fromEntries(followedIds.map((id, i) => [id, i]));
        posts = (data ?? []).sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0));
      }
    }
  } else {
    let query = supabase
      .from("community_posts")
      .select("id, user_id, post_type, title, body, photos, solved, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    if (validType) query = query.eq("post_type", validType);
    if (searchQuery) query = query.or(`title.ilike.%${searchQuery}%,body.ilike.%${searchQuery}%`);
    if (validSort === "unanswered") query = query.eq("post_type", validType ?? "help");

    const { data: rawPosts } = await query;
    posts = rawPosts ?? [];
  }

  const authorIds = [...new Set(posts.map((p) => p.user_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", authorIds)
    : { data: [] };
  const authorMap = Object.fromEntries((authors ?? []).map((a) => [a.id, a]));

  const postIds = posts.map((p) => p.id);
  const { data: replyCounts } = postIds.length
    ? await supabase.from("community_replies").select("post_id").in("post_id", postIds)
    : { data: [] };
  const replyCountMap: Record<string, number> = {};
  for (const r of replyCounts ?? []) {
    replyCountMap[r.post_id] = (replyCountMap[r.post_id] ?? 0) + 1;
  }

  // Fetch which posts the current user has saved (for bookmark state on cards)
  let followedPostIds = new Set<string>();
  if (user && postIds.length) {
    const { data: userFollows } = await supabase
      .from("community_post_follows")
      .select("post_id")
      .eq("user_id", user.id)
      .in("post_id", postIds);
    followedPostIds = new Set((userFollows ?? []).map((f) => f.post_id));
  }

  // Apply client-side sort / filter after reply counts are known (non-saved view)
  if (!isSavedView) {
    if (validSort === "most_replies") {
      posts.sort((a, b) => (replyCountMap[b.id] ?? 0) - (replyCountMap[a.id] ?? 0));
    } else if (validSort === "unanswered") {
      posts = posts.filter((p) => p.post_type === "help" && (replyCountMap[p.id] ?? 0) === 0);
    }
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

      {/* Search (hidden in saved/gardens view) */}
      {!isSavedView && !isGardensView && (
        <Suspense>
          <CommunitySearchBar />
        </Suspense>
      )}

      {/* Top-level tabs: All / Saved / Gardens */}
      <div className="flex flex-wrap gap-2 mb-3">
        <FilterChip href="/community" label="All Posts" active={!isSavedView && !isGardensView} />
        <FilterChip href="/community?view=saved" label="Saved" active={isSavedView} icon={<Bookmark size={12} />} />
        <FilterChip href="/community?view=gardens" label="Gardens" active={isGardensView} />
        {!isSavedView && !isGardensView && (
          <>
            <FilterChip href={buildHref({ sort: validSort, q: searchQuery })} label="All" active={!validType} />
            <FilterChip href={buildHref({ type: "help", sort: validSort, q: searchQuery })} label="Help Requests" active={validType === "help"} title="Ask for advice, plant ID, or troubleshooting help" />
            <FilterChip href={buildHref({ type: "show_and_tell", sort: validSort, q: searchQuery })} label="Show & Tell" active={validType === "show_and_tell"} title="Share a plant, growth update, or proud moment" />
            <FilterChip href={buildHref({ type: "discussion", sort: validSort, q: searchQuery })} label="Discussions" active={validType === "discussion"} title="Open-ended conversations about care, species, or anything plant-related" />
          </>
        )}
      </div>

      {/* Sort chips (hidden in saved/gardens view) */}
      {!isSavedView && !isGardensView && (
        <div className="flex flex-wrap gap-2 mb-6">
          <FilterChip href={buildHref({ type: validType, q: searchQuery })} label="Newest" active={validSort === "newest"} small />
          <FilterChip href={buildHref({ type: validType, sort: "most_replies", q: searchQuery })} label="Most Replies" active={validSort === "most_replies"} small />
          <FilterChip href={buildHref({ type: validType, sort: "unanswered", q: searchQuery })} label="Unanswered" active={validSort === "unanswered"} small />
        </div>
      )}

      {isSavedView && <div className="mb-6" />}

      {/* Gardens view */}
      {isGardensView && (
        <div className="mt-2">
          <CommunityGardensGrid
            gardens={gardens}
            gardenMap={gardenMap}
            currentUserId={user?.id ?? null}
          />
        </div>
      )}

      {/* Posts view */}
      {!isGardensView && posts.length === 0 ? (
        <div className="text-center py-20 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">{isSavedView ? "🔖" : "🌿"}</p>
          {isSavedView && !user ? (
            <>
              <p className="font-semibold mb-1">Sign in to save posts</p>
              <p className="text-sm text-muted-foreground mb-4">Bookmark posts to find them again later.</p>
              <Link href="/login" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>Sign in</Link>
            </>
          ) : isSavedView ? (
            <>
              <p className="font-semibold mb-1">No saved posts yet</p>
              <p className="text-sm text-muted-foreground mb-4">Hit the bookmark icon on any post to save it here.</p>
              <Link href="/community" className={cn(buttonVariants({ variant: "outline" }))}>Browse posts</Link>
            </>
          ) : searchQuery ? (
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
          {posts.map((post) => {
            const author = authorMap[post.user_id];
            const replyCount = replyCountMap[post.id] ?? 0;
            const isFollowed = followedPostIds.has(post.id);
            return (
              <div key={post.id} className="relative">
                <Link
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
                      <p className="font-semibold text-sm leading-snug line-clamp-2 pr-8">{post.title}</p>
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
                {/* Bookmark button sits outside the Link to avoid nested interactive elements */}
                <div className="absolute top-3 right-3">
                  <PostFollowButton postId={post.id} initialFollowing={isFollowed} size="sm" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FilterChip({
  href, label, active, small, icon, title,
}: {
  href: string; label: string; active: boolean; small?: boolean; icon?: React.ReactNode; title?: string;
}) {
  return (
    <Link
      href={href}
      title={title}
      className={cn(
        "rounded-full font-medium transition-colors border flex items-center gap-1",
        small ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
        active
          ? "bg-green-700 text-white border-green-700"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-green-400"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
