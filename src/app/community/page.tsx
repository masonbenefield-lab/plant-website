import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { MessageCircle, CheckCircle2, Bookmark, Leaf, ArrowLeft } from "lucide-react";
import { CommunitySearchBar } from "@/components/community-search-bar";
import { PostFollowButton } from "@/components/community/post-follow-button";
import { PostLikeButton } from "@/components/community/post-like-button";
import { CommunityPlantsGrid } from "@/components/community/plants-grid";
import CommunityGardensGrid from "@/components/garden/community-gardens-grid";
import ReportButton from "@/components/report-button";
import { DeletePostButton } from "@/components/community/delete-post-button";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const TYPE_LABEL = { help: "Help Request", show_and_tell: "Show & Tell", discussion: "Discussion" } as const;
const TYPE_COLOR = {
  help: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  show_and_tell: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
  discussion: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
} as const;

type PostType = "help" | "show_and_tell" | "discussion";

function buildHref(params: { type?: string; sort?: string; q?: string; view?: string; page?: number }) {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.view) p.set("view", params.view);
  if (!params.view) {
    if (params.type) p.set("type", params.type);
    if (params.sort && params.sort !== "newest") p.set("sort", params.sort);
  }
  if (params.page && params.page > 1) p.set("page", String(params.page));
  const s = p.toString();
  return s ? `/community?${s}` : "/community";
}

const PAGE_SIZE = 25;

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; sort?: string; q?: string; view?: string; page?: string; plant?: string }>;
}) {
  const supabase = await createClient();
  const { type, sort, q, view, page: pageParam, plant } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const { data: { user } } = await supabase.auth.getUser();

  const isSavedView = view === "saved";
  const isGardensView = view === "gardens";
  const isPlantView = view === "plants";
  const isMineView = view === "mine";
  const validType = (["help", "show_and_tell", "discussion"] as const).find((t) => t === type);
  const validSort = (["newest", "most_replies", "unanswered"] as const).find((s) => s === sort) ?? "newest";
  const searchQuery = q?.trim() ?? "";
  const plantFilter = plant?.trim() ?? "";

  // Gardens view data
  type GardenProfile = { id: string; username: string; display_name: string | null; avatar_url: string | null; garden_bio: string | null; open_to_trades: boolean | null };
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

  // Plants view — directory or filtered posts
  let plantDirectory: { name: string; count: number }[] = [];

  if (isPlantView && !plantFilter) {
    const { data: tagRows } = await supabase
      .from("community_posts")
      .select("plant_tag")
      .not("plant_tag", "is", null);
    const counts: Record<string, number> = {};
    for (const r of tagRows ?? []) {
      if (r.plant_tag) counts[r.plant_tag] = (counts[r.plant_tag] ?? 0) + 1;
    }
    plantDirectory = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({ name, count }));
  }

  let posts: { id: string; user_id: string; post_type: string; title: string; body: string | null; photos: unknown; solved: boolean; created_at: string; plant_tag?: string | null }[] = [];

  if (isMineView) {
    if (user) {
      const { data } = await supabase
        .from("community_posts")
        .select("id, user_id, post_type, title, body, photos, solved, created_at, plant_tag")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      posts = data ?? [];
    }
  } else if (isSavedView) {
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
          .select("id, user_id, post_type, title, body, photos, solved, created_at, plant_tag")
          .in("id", followedIds);
        const orderMap = Object.fromEntries(followedIds.map((id, i) => [id, i]));
        posts = (data ?? []).sort((a, b) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0));
      }
    }
  } else if (isPlantView && plantFilter) {
    const { data } = await supabase
      .from("community_posts")
      .select("id, user_id, post_type, title, body, photos, solved, created_at, plant_tag")
      .eq("plant_tag", plantFilter)
      .order("created_at", { ascending: false });
    posts = data ?? [];
  } else if (!isGardensView && !isPlantView) {
    let query = supabase
      .from("community_posts")
      .select("id, user_id, post_type, title, body, photos, solved, created_at, plant_tag")
      .order("created_at", { ascending: false })
      .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

  let followedPostIds = new Set<string>();
  let reportedPostIds = new Set<string>();
  let likedPostIds = new Set<string>();
  const likeCountMap: Record<string, number> = {};

  if (postIds.length) {
    const { data: allLikes } = await supabase
      .from("community_post_likes")
      .select("post_id, user_id")
      .in("post_id", postIds);
    for (const l of allLikes ?? []) {
      likeCountMap[l.post_id] = (likeCountMap[l.post_id] ?? 0) + 1;
    }
    if (user) likedPostIds = new Set((allLikes ?? []).filter((l) => l.user_id === user.id).map((l) => l.post_id));
  }

  if (user && postIds.length) {
    const [{ data: userFollows }, { data: userReports }] = await Promise.all([
      supabase.from("community_post_follows").select("post_id").eq("user_id", user.id).in("post_id", postIds),
      supabase.from("reports").select("community_post_id").eq("reporter_id", user.id).in("community_post_id", postIds),
    ]);
    followedPostIds = new Set((userFollows ?? []).map((f) => f.post_id));
    reportedPostIds = new Set((userReports ?? []).map((r) => r.community_post_id).filter(Boolean) as string[]);
  }

  if (!isSavedView) {
    if (validSort === "most_replies") {
      posts.sort((a, b) => (replyCountMap[b.id] ?? 0) - (replyCountMap[a.id] ?? 0));
    } else if (validSort === "unanswered") {
      posts = posts.filter((p) => p.post_type === "help" && (replyCountMap[p.id] ?? 0) === 0);
    }
  }

  const hasNextPage = !isSavedView && !isMineView && !isPlantView && posts.length > PAGE_SIZE;
  const visiblePosts = (isSavedView || isMineView || isPlantView) ? posts : posts.slice(0, PAGE_SIZE);

  const showPostsPanel = !isGardensView && !isPlantView;
  const showPlantPostsPanel = isPlantView && !!plantFilter;
  const showPlantDirectory = isPlantView && !plantFilter;

  return (
    <div className={cn("mx-auto px-4 py-10", isGardensView ? "max-w-5xl" : "max-w-3xl")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Community</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Ask questions, share plants, and connect with other growers ·{" "}
            <Link href="/community/guidelines" className="hover:text-foreground underline underline-offset-2">Guidelines</Link>
          </p>
        </div>
        {!isGardensView && !showPlantDirectory && (
          user ? (
            <Link href="/community/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
              + New Post
            </Link>
          ) : (
            <Link
              href="/login?redirectTo=/community/new&message=Sign+in+to+create+a+post"
              className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}
            >
              + New Post
            </Link>
          )
        )}
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b mb-6">
        <SectionTab href="/community" active={!isGardensView && !isPlantView}>Posts</SectionTab>
        <SectionTab href="/community?view=gardens" active={isGardensView}>Gardens</SectionTab>
        <SectionTab href="/community?view=plants" active={isPlantView}>Plants</SectionTab>
      </div>

      {/* ── POSTS TAB ── */}
      {showPostsPanel && (
        <>
          {!isSavedView && (
            <Suspense>
              <CommunitySearchBar />
            </Suspense>
          )}

          <div className="flex flex-wrap gap-2 mb-3">
            <FilterChip href="/community" label="All Posts" active={!isSavedView && !isMineView} />
            <FilterChip href="/community?view=saved" label="Saved" active={isSavedView} icon={<Bookmark size={12} />} />
            {user && <FilterChip href="/community?view=mine" label="My Posts" active={isMineView} />}
            {!isSavedView && !isMineView && (
              <>
                <FilterChip href={buildHref({ sort: validSort, q: searchQuery })} label="All" active={!validType} />
                <FilterChip href={buildHref({ type: "help", sort: validSort, q: searchQuery })} label="Help Requests" active={validType === "help"} title="Ask for advice, plant ID, or troubleshooting help" />
                <FilterChip href={buildHref({ type: "show_and_tell", sort: validSort, q: searchQuery })} label="Show & Tell" active={validType === "show_and_tell"} title="Share a plant, growth update, or proud moment" />
                <FilterChip href={buildHref({ type: "discussion", sort: validSort, q: searchQuery })} label="Discussions" active={validType === "discussion"} title="Open-ended conversations about care, species, or anything plant-related" />
              </>
            )}
          </div>

          {!isSavedView && !isMineView && (
            <div className="flex flex-wrap gap-2 mb-6">
              <FilterChip href={buildHref({ type: validType, q: searchQuery })} label="Newest" active={validSort === "newest"} small />
              <FilterChip href={buildHref({ type: validType, sort: "most_replies", q: searchQuery })} label="Most Replies" active={validSort === "most_replies"} small />
              <FilterChip href={buildHref({ type: validType, sort: "unanswered", q: searchQuery })} label="Unanswered" active={validSort === "unanswered"} small />
            </div>
          )}

          {(isSavedView || isMineView) && <div className="mb-6" />}

          <PostsList
            posts={visiblePosts}
            authorMap={authorMap}
            replyCountMap={replyCountMap}
            likeCountMap={likeCountMap}
            likedPostIds={likedPostIds}
            followedPostIds={followedPostIds}
            reportedPostIds={reportedPostIds}
            userId={user?.id ?? null}
            isSavedView={isSavedView}
            isMineView={isMineView}
            searchQuery={searchQuery}
            validType={validType}
            validSort={validSort}
          />

          {!isSavedView && !isMineView && (page > 1 || hasNextPage) && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              {page > 1 ? (
                <Link
                  href={buildHref({ type: validType, sort: validSort, q: searchQuery, page: page - 1 })}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  ← Previous
                </Link>
              ) : <span />}
              <span className="text-xs text-muted-foreground">Page {page}</span>
              {hasNextPage ? (
                <Link
                  href={buildHref({ type: validType, sort: validSort, q: searchQuery, page: page + 1 })}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Next →
                </Link>
              ) : <span />}
            </div>
          )}
        </>
      )}

      {/* ── GARDENS TAB ── */}
      {isGardensView && (
        <CommunityGardensGrid
          gardens={gardens}
          gardenMap={gardenMap}
          currentUserId={user?.id ?? null}
        />
      )}

      {/* ── PLANTS TAB — directory ── */}
      {showPlantDirectory && (
        <CommunityPlantsGrid plants={plantDirectory} />
      )}

      {/* ── PLANTS TAB — posts for a specific plant ── */}
      {showPlantPostsPanel && (
        <>
          <div className="flex items-center gap-3 mb-6">
            <Link
              href="/community?view=plants"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={14} />
              All Plants
            </Link>
            <span className="text-muted-foreground">/</span>
            <div className="flex items-center gap-1.5">
              <Leaf size={14} className="text-leaf" />
              <span className="font-semibold text-sm">{plantFilter}</span>
            </div>
            {user && (
              <Link
                href={`/community/new?plant=${encodeURIComponent(plantFilter)}`}
                className={cn(buttonVariants({ size: "sm" }), "ml-auto bg-leaf hover:bg-forest")}
              >
                + Post about this plant
              </Link>
            )}
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-20 border rounded-xl bg-muted/30">
              <p className="text-4xl mb-4">🌿</p>
              <p className="font-semibold mb-1">No posts about {plantFilter} yet</p>
              <p className="text-sm text-muted-foreground mb-5">
                Be the first to start a discussion about this plant.
              </p>
              {user ? (
                <Link
                  href={`/community/new?plant=${encodeURIComponent(plantFilter)}`}
                  className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}
                >
                  Create a post
                </Link>
              ) : (
                <Link href="/login" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
                  Sign in to post
                </Link>
              )}
            </div>
          ) : (
            <PostsList
              posts={visiblePosts}
              authorMap={authorMap}
              replyCountMap={replyCountMap}
              likeCountMap={likeCountMap}
              likedPostIds={likedPostIds}
              followedPostIds={followedPostIds}
              reportedPostIds={reportedPostIds}
              userId={user?.id ?? null}
              isSavedView={false}
              isMineView={false}
              searchQuery=""
              validType={undefined}
              validSort="newest"
            />
          )}
        </>
      )}
    </div>
  );
}

// Extracted post list to avoid duplication
function PostsList({
  posts,
  authorMap,
  replyCountMap,
  likeCountMap,
  likedPostIds,
  followedPostIds,
  reportedPostIds,
  userId,
  isSavedView,
  isMineView,
  searchQuery,
  validType,
  validSort,
}: {
  posts: { id: string; user_id: string; post_type: string; title: string; body: string | null; photos: unknown; solved: boolean; created_at: string; plant_tag?: string | null }[];
  authorMap: Record<string, { id: string; username: string; avatar_url: string | null } | undefined>;
  replyCountMap: Record<string, number>;
  likeCountMap: Record<string, number>;
  likedPostIds: Set<string>;
  followedPostIds: Set<string>;
  reportedPostIds: Set<string>;
  userId: string | null;
  isSavedView: boolean;
  isMineView: boolean;
  searchQuery: string;
  validType: PostType | undefined;
  validSort: string;
}) {
  if (posts.length === 0) {
    return (
      <div className="text-center py-20 border rounded-xl bg-muted/30">
        <p className="text-4xl mb-4">{isSavedView ? "🔖" : isMineView ? "✍️" : "🌿"}</p>
        {isMineView && !userId ? (
          <>
            <p className="font-semibold mb-1">Sign in to see your posts</p>
            <Link href="/login" className={cn(buttonVariants(), "bg-leaf hover:bg-forest mt-3")}>Sign in</Link>
          </>
        ) : isMineView ? (
          <>
            <p className="font-semibold mb-1">You haven&apos;t posted yet</p>
            <p className="text-sm text-muted-foreground mb-4">Share a question, a plant, or start a discussion.</p>
            <Link href="/community/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>Create your first post</Link>
          </>
        ) : isSavedView && !userId ? (
          <>
            <p className="font-semibold mb-1">Sign in to save posts</p>
            <p className="text-sm text-muted-foreground mb-4">Bookmark posts to find them again later.</p>
            <Link href="/login" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>Sign in</Link>
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
            <Link href={buildHref({ type: validType, sort: validSort })} className="text-sm text-leaf hover:underline">Clear search</Link>
          </>
        ) : (
          <>
            <p className="font-semibold mb-1">Nothing here yet</p>
            <p className="text-sm text-muted-foreground mb-6">Be the first to post in the community.</p>
            <Link href="/community/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
              Post something
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {posts.map((post) => {
        const author = authorMap[post.user_id];
        const replyCount = replyCountMap[post.id] ?? 0;
        const isFollowed = followedPostIds.has(post.id);
        return (
          <div key={post.id} className="relative group">
            <Link
              href={`/community/${post.id}`}
              className="block rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarImage src={author?.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-[#DFE7D4] text-leaf text-xs font-semibold">
                    {author?.username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={cn("text-xs px-1.5 py-0 border-0", TYPE_COLOR[post.post_type as PostType])}>
                      {TYPE_LABEL[post.post_type as PostType]}
                    </Badge>
                    {post.solved && (
                      <span className="flex items-center gap-0.5 text-xs text-leaf font-medium">
                        <CheckCircle2 size={12} /> Solved
                      </span>
                    )}
                    {post.plant_tag && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                        <Leaf size={10} className="text-leaf" />
                        {post.plant_tag}
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
                    <PostLikeButton
                      postId={post.id}
                      initialLiked={likedPostIds.has(post.id)}
                      initialCount={likeCountMap[post.id] ?? 0}
                      currentUserId={userId}
                    />
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
            <div className="absolute top-3 right-3">
              <PostFollowButton postId={post.id} initialFollowing={isFollowed} size="sm" />
            </div>
            {userId && post.user_id !== userId && (
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <ReportButton
                  userId={userId}
                  communityPostId={post.id}
                  targetName={post.title}
                  initialReported={reportedPostIds.has(post.id)}
                />
              </div>
            )}
            {userId && post.user_id === userId && (
              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                <DeletePostButton postId={post.id} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionTab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
        active
          ? "border-leaf text-leaf"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
      )}
    >
      {children}
    </Link>
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
          ? "bg-leaf text-white border-leaf"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-sage"
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
