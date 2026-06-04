import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MapPin, ArrowLeftRight } from "lucide-react";
import FollowButton from "@/components/follow-button";
import ShareButton from "@/components/share-button";
import { MessageButton } from "@/components/message-button";
import { StorefrontMoreMenu } from "@/components/storefront-more-menu";
import { StorefrontBannerEditor, StorefrontAvatarEditor } from "@/components/storefront-photo-editor";
import RateSellerForm from "@/app/orders/rate-seller-form";
import { ReportReviewButton } from "@/components/report-review-button";
import { StorefrontListings, StorefrontAuctions, StorefrontGarden, StorefrontWishlist } from "./storefront-listings";
import SocialLinks from "@/components/social-links";
import type { Database } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username, bio, avatar_url")
    .eq("username", username)
    .single();

  if (!data) return { title: "Seller Not Found — Plantet" };

  const title = `${data.username} — Plantet Storefront`;
  const description = data.bio || `Browse plants from ${data.username} on Plantet`;
  const image = data.avatar_url as string | null;

  return {
    title,
    description,
    openGraph: { title, description, ...(image ? { images: [{ url: image }] } : {}) },
  };
}

export default async function SellerStorefront({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { username } = await params;
  const { tab } = await searchParams;
  const VALID_TABS = ["shop", "auctions", "updates", "reviews", "garden", "wishlist"];
  const activeTab = VALID_TABS.includes(tab ?? "") ? tab! : "shop";
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const adminClient = createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // Fetch active (non-archived) inventory rows, including which listing each row currently points to as primary
  const { data: activeInv } = await adminClient.from("inventory").select("id, listing_id").eq("seller_id", profile.id).is("archived_at", null);
  const activeInvIds = new Set(activeInv?.map(r => r.id) ?? []);
  // Set of listing IDs that are the current primary listing for some active inventory row
  const primaryListingIds = new Set(activeInv?.filter(r => r.listing_id).map(r => r.listing_id!) ?? []);

  const [{ data: rawListings }, { data: auctions }, { data: ratings }, { count: followerCount }, { data: gardenPlants }, { data: announcements }, { data: wishlistItems }] =
    await Promise.all([
      // Admin client bypasses RLS so sold_out listings are visible to all visitors, not just the seller
      adminClient.from("listings").select("*").eq("seller_id", profile.id).in("status", ["active", "sold_out"]).or("category.neq.Hidden,category.is.null").order("created_at", { ascending: false }),
      profile.stripe_onboarded
        ? supabase.from("auctions").select("*").eq("seller_id", profile.id).eq("status", "active").or("category.neq.Hidden,category.is.null").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("ratings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("seller_id", profile.id),
      profile.garden_public
        ? createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).from("garden_plants").select("id, name, variety, status, location, planted_at, images, public_notes, pin_order").eq("user_id", profile.id).or("is_public.eq.true,is_public.is.null").order("pin_order", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("announcements").select("id, body, photos, created_at").eq("seller_id", profile.id).order("created_at", { ascending: false }).limit(20),
      profile.wishlist_public
        ? createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!).from("wishlist_items").select("id, name, variety, notes, priority").eq("user_id", profile.id).order("name", { ascending: true }).order("variety", { ascending: true })
        : Promise.resolve({ data: [] }),
    ]);

  // Only show listings that are genuinely current:
  //  - Standalone (no inventory_id): always show
  //  - Linked to active inventory AND is that inventory row's current primary listing
  //    (guards against orphaned old listing rows that still have inventory_id set but were
  //     superseded when a new listing was created for the same inventory row)
  const listings = (rawListings ?? []).filter(l => {
    const invId = (l as { inventory_id?: string | null }).inventory_id;
    if (!invId) return true;                        // standalone — no inventory link
    if (!activeInvIds.has(invId)) return false;     // inventory deleted or archived
    return primaryListingIds.has(l.id);             // must be the inventory's current primary listing
  });

  const reviewerIds = [...new Set(ratings?.map((r) => r.reviewer_id) ?? [])];
  const { data: reviewers } = reviewerIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", reviewerIds)
    : { data: [] };
  const reviewerMap = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r]));

  // Fetch which reviews the seller has already reported (only needed on their own profile)
  const reportedRatingIds = new Set<string>();
  if (user?.id === profile.id && (ratings?.length ?? 0) > 0) {
    const { data: existingReports } = await adminClient
      .from("review_reports")
      .select("rating_id")
      .eq("reporter_id", user.id)
      .in("rating_id", ratings!.map((r) => r.id));
    for (const r of existingReports ?? []) {
      if (r.rating_id) reportedRatingIds.add(r.rating_id);
    }
  }

  const isFollowing = user
    ? !!(await supabase.from("follows").select("id").eq("follower_id", user.id).eq("seller_id", profile.id).maybeSingle()).data
    : false;

  const isReportedUser = user && user.id !== profile.id
    ? !!(await supabase.from("reports").select("id").eq("reporter_id", user.id).eq("reported_user_id", profile.id).maybeSingle()).data
    : false;

  const isBlockedUser = user && user.id !== profile.id
    ? !!(await createAdminClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
        .from("blocks").select("id").eq("blocker_id", user.id).eq("blocked_id", profile.id).maybeSingle()).data
    : false;

  // Find an unrated delivered order the viewer placed with this seller
  let orderToRate: string | null = null;
  if (user && user.id !== profile.id) {
    const [{ data: deliveredOrders }, { data: viewerRatings }] = await Promise.all([
      supabase.from("orders").select("id").eq("buyer_id", user.id).eq("seller_id", profile.id).eq("status", "delivered"),
      supabase.from("ratings").select("order_id").eq("reviewer_id", user.id).eq("seller_id", profile.id),
    ]);
    const ratedIds = new Set(viewerRatings?.map((r) => r.order_id) ?? []);
    orderToRate = deliveredOrders?.find((o) => !ratedIds.has(o.id))?.id ?? null;
  }

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  const avgScore =
    ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Payments not set up notice */}
      {!profile.stripe_onboarded && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-4 py-3 text-sm text-blue-800 dark:text-blue-300">
          💳 <strong>{profile.username}</strong> hasn&apos;t connected their payment account yet — you can browse what they have available, but purchases aren&apos;t possible until they finish setup.
        </div>
      )}

      {/* Vacation notice */}
      {profile.vacation_mode && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          🏖️ This seller is currently on vacation and not shipping orders.
          {profile.vacation_until && (
            <> Expected back {new Date(profile.vacation_until).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.</>
          )}
        </div>
      )}

      {/* Storefront announcement */}
      {(profile as { announcement?: string | null }).announcement &&
        !(
          (profile as { announcement_expires_at?: string | null }).announcement_expires_at &&
          new Date((profile as { announcement_expires_at?: string | null }).announcement_expires_at!) < new Date()
        ) && (
        <div className="mb-6 rounded-lg border border-[#C5D4BC] bg-[#EBF0E6] dark:bg-forest/30 dark:border-forest px-4 py-3 text-sm text-forest dark:text-[#C5D4BC] font-medium">
          {(profile as { announcement?: string | null }).announcement}
        </div>
      )}

      {/* Banner */}
      {user?.id === profile.id ? (
        <StorefrontBannerEditor userId={profile.id} initialUrl={profile.banner_url} />
      ) : profile.banner_url ? (
        <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-72 rounded-2xl overflow-hidden mb-6">
          <Image
            src={profile.banner_url}
            alt={`${profile.username}'s store banner`}
            fill
            className="object-cover object-center"
            priority
          />
        </div>
      ) : null}

      {/* Header */}
      <div className="flex items-start gap-6 mb-10">
        {user?.id === profile.id ? (
          <StorefrontAvatarEditor
            userId={profile.id}
            initialUrl={profile.avatar_url}
            fallback={profile.username.slice(0, 1).toUpperCase()}
          />
        ) : (
          <Avatar className="h-20 w-20">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-[#DFE7D4] text-leaf text-2xl font-bold">
              {profile.username.slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
        <div className="flex-1">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold">{profile.display_name || profile.username}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ShareButton username={profile.username} />
              <FollowButton
                userId={user?.id ?? null}
                sellerId={profile.id}
                initialFollowing={isFollowing}
                initialCount={followerCount ?? 0}
              />
              {user && user.id !== profile.id && (
                <MessageButton recipientId={profile.id} />
              )}
              {user && user.id !== profile.id && (
                <StorefrontMoreMenu
                  userId={user.id}
                  reportedUserId={profile.id}
                  targetName={profile.username}
                  initialReported={isReportedUser}
                  initialBlocked={isBlockedUser}
                />
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>
          )}
          {/* Primary metadata: location, tenure, followers */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
            {(profile as { groundbreaker?: boolean; groundbreaker_number?: number | null }).groundbreaker && (
              <span className="font-semibold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                ⛏️ Groundbreaker {(profile as { groundbreaker_number?: number | null }).groundbreaker_number ? `#${(profile as { groundbreaker_number?: number | null }).groundbreaker_number}` : ""}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin size={11} />
                {profile.location}
              </span>
            )}
            <span>Member since {memberSince}</span>
            {profile.show_follower_count && (followerCount ?? 0) > 0 && (
              <span>{followerCount} follower{followerCount !== 1 ? "s" : ""}</span>
            )}
          </div>

          {/* Secondary metadata: trades */}
          {(profile as { open_to_trades?: boolean }).open_to_trades && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {user && user.id !== profile.id ? (
                <Link
                  href={`/messages?to=${profile.username}`}
                  className="flex items-center gap-1 text-xs font-medium text-leaf bg-[#DFE7D4] dark:bg-forest/40 dark:text-sage px-2.5 py-1 rounded-full hover:bg-[#c8d8bc] dark:hover:bg-forest/60 transition-colors"
                >
                  <ArrowLeftRight size={11} />
                  Open to trades
                </Link>
              ) : (
                <span className="flex items-center gap-1 text-xs font-medium text-leaf bg-[#DFE7D4] dark:bg-forest/40 dark:text-sage px-2.5 py-1 rounded-full">
                  <ArrowLeftRight size={11} />
                  Open to trades
                </span>
              )}
            </div>
          )}
          {avgScore !== null && (
            <div className="flex items-center gap-1 mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={`h-4 w-4 ${n <= Math.round(avgScore) ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                />
              ))}
              <span className="text-sm text-muted-foreground ml-1">
                {avgScore.toFixed(1)} ({ratings!.length} review{ratings!.length !== 1 ? "s" : ""})
              </span>
            </div>
          )}
          <SocialLinks links={profile.social_links as Record<string, string> | null} />
        </div>
      </div>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="shop">Shop ({listings.filter(l => l.status === "active").length})</TabsTrigger>
          {profile.stripe_onboarded && (
            <TabsTrigger value="auctions">Auctions ({auctions?.length ?? 0})</TabsTrigger>
          )}
          {(announcements?.length ?? 0) > 0 && (
            <TabsTrigger value="updates">Updates ({announcements?.length ?? 0})</TabsTrigger>
          )}
          <TabsTrigger value="reviews">Reviews ({ratings?.length ?? 0})</TabsTrigger>
          {profile.garden_public && (
            <TabsTrigger value="garden">Garden ({gardenPlants?.length ?? 0})</TabsTrigger>
          )}
          {profile.wishlist_public && (
            <TabsTrigger value="wishlist">Wishlist ({wishlistItems?.length ?? 0})</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="shop" className="mt-6">
          <StorefrontListings
            paymentsEnabled={!!profile.stripe_onboarded}
            listings={listings.map(l => ({
              id: l.id,
              plant_name: l.plant_name,
              variety: l.variety ?? null,
              price_cents: l.price_cents,
              images: l.images as string[],
              quantity: l.quantity,
              category: (l as { category?: string | null }).category ?? null,
              status: l.status,
            }))}
          />
        </TabsContent>

        <TabsContent value="auctions" className="mt-6">
          <StorefrontAuctions
            paymentsEnabled={!!profile.stripe_onboarded}
            auctions={(auctions ?? []).map(a => ({
              id: a.id,
              plant_name: a.plant_name,
              variety: a.variety ?? null,
              current_bid_cents: a.current_bid_cents,
              images: a.images as string[],
              ends_at: a.ends_at,
              category: (a as { category?: string | null }).category ?? null,
            }))}
          />
        </TabsContent>

        <TabsContent value="updates" className="mt-6">
          <div className="space-y-4 max-w-2xl">
            {(announcements ?? []).map((a) => (
              <div key={a.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={profile.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#DFE7D4] text-leaf text-xs font-semibold">
                      {profile.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium">{profile.display_name || profile.username}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.body}</p>
                    {(a.photos as string[]).length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {(a.photos as string[]).map((url, i) => (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                            <Image src={url} alt="Update photo" width={96} height={96}
                              className="rounded-lg object-cover border hover:opacity-80 transition-opacity w-24 h-24" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <div className="space-y-6">
            {/* Submit a review */}
            {orderToRate && (
              <Card className="border-[#C5D4BC] bg-[#EBF0E6] dark:bg-forest/20 dark:border-forest">
                <CardContent className="p-5">
                  <RateSellerForm orderId={orderToRate} sellerUsername={profile.username} />
                </CardContent>
              </Card>
            )}

            {/* Existing reviews */}
            {!ratings?.length ? (
              <p className="text-muted-foreground">No reviews yet.</p>
            ) : (
              <div className="space-y-4">
                {ratings.map((rating) => {
                  const reviewer = reviewerMap[rating.reviewer_id] ?? null;
                  return (
                    <Card key={rating.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3 mb-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={reviewer?.avatar_url ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {reviewer?.username?.slice(0, 1).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{reviewer?.username}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            {new Date(rating.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <div className="flex items-center gap-0.5 ml-auto">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <Star
                                key={n}
                                className={`h-3.5 w-3.5 ${n <= rating.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
                              />
                            ))}
                          </div>
                          {user?.id === profile.id && (
                            <ReportReviewButton
                              ratingId={rating.id}
                              initialReported={reportedRatingIds.has(rating.id)}
                            />
                          )}
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-muted-foreground">{rating.comment}</p>
                        )}
                        {(rating.photos as string[] | null)?.length ? (
                          <div className="flex gap-2 flex-wrap mt-2">
                            {(rating.photos as string[]).map((url) => (
                              <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                                <Image
                                  src={url}
                                  alt="Review photo"
                                  width={80}
                                  height={80}
                                  className="rounded-md object-cover border hover:opacity-90 transition-opacity"
                                />
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
        {profile.garden_public && (
          <TabsContent value="garden" className="mt-6">
            <StorefrontGarden
              plants={(gardenPlants ?? []).map((p) => ({ ...p, images: p.images as string[] | null }))}
              username={username}
              canWishlist={!!user && user.id !== profile.id}
            />
          </TabsContent>
        )}
        {profile.wishlist_public && (
          <TabsContent value="wishlist" className="mt-6">
            <StorefrontWishlist
              items={wishlistItems ?? []}
              canWishlist={!!user && user.id !== profile.id}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
