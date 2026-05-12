import { notFound } from "next/navigation";
import Image from "next/image";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star, MapPin, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";
import FollowButton from "@/components/follow-button";
import ReportButton from "@/components/report-button";
import ShareButton from "@/components/share-button";
import { MessageButton } from "@/components/message-button";
import RateSellerForm from "@/app/orders/rate-seller-form";
import { StorefrontListings, StorefrontAuctions } from "./storefront-listings";
import type { GardenPlantStatus } from "@/lib/supabase/types";

const GARDEN_STATUS_LABEL: Record<GardenPlantStatus, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const GARDEN_STATUS_COLOR: Record<GardenPlantStatus, string> = {
  thriving: "bg-green-100 text-green-700",
  growing: "bg-emerald-100 text-emerald-700",
  dormant: "bg-yellow-100 text-yellow-700",
  struggling: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-500",
};

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
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (!profile) notFound();

  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: listings }, { data: auctions }, { data: ratings }, { count: followerCount }, { data: gardenPlants }, { data: announcements }] =
    await Promise.all([
      supabase.from("listings").select("*").eq("seller_id", profile.id).eq("status", "active").or("category.neq.Hidden,category.is.null").order("created_at", { ascending: false }),
      profile.stripe_onboarded
        ? supabase.from("auctions").select("*").eq("seller_id", profile.id).eq("status", "active").or("category.neq.Hidden,category.is.null").order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("ratings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("seller_id", profile.id),
      profile.garden_public
        ? supabase.from("garden_plants").select("id, name, variety, status, location, planted_at, images, public_notes").eq("user_id", profile.id).eq("is_public", true).order("created_at", { ascending: false })
        : Promise.resolve({ data: [] }),
      supabase.from("announcements").select("id, body, photos, created_at").eq("seller_id", profile.id).order("created_at", { ascending: false }).limit(20),
    ]);

  const reviewerIds = [...new Set(ratings?.map((r) => r.reviewer_id) ?? [])];
  const { data: reviewers } = reviewerIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", reviewerIds)
    : { data: [] };
  const reviewerMap = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r]));

  const isFollowing = user
    ? !!(await supabase.from("follows").select("id").eq("follower_id", user.id).eq("seller_id", profile.id).maybeSingle()).data
    : false;

  const isReportedUser = user && user.id !== profile.id
    ? !!(await supabase.from("reports").select("id").eq("reporter_id", user.id).eq("reported_user_id", profile.id).maybeSingle()).data
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
      {(profile as { announcement?: string | null }).announcement && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 px-4 py-3 text-sm text-green-900 dark:text-green-200 font-medium">
          {(profile as { announcement?: string | null }).announcement}
        </div>
      )}

      {/* Banner */}
      {profile.banner_url && (
        <div className="relative w-full h-48 sm:h-56 md:h-64 lg:h-72 rounded-2xl overflow-hidden mb-6">
          <Image
            src={profile.banner_url}
            alt={`${profile.username}'s store banner`}
            fill
            className="object-cover object-center"
            priority
          />
        </div>
      )}

      {/* Header */}
      <div className="flex items-start gap-6 mb-10">
        <Avatar className="h-20 w-20">
          <AvatarImage src={profile.avatar_url ?? undefined} />
          <AvatarFallback className="bg-green-100 text-green-700 text-2xl font-bold">
            {profile.username.slice(0, 1).toUpperCase()}
          </AvatarFallback>
        </Avatar>
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
                <ReportButton
                  userId={user.id}
                  reportedUserId={profile.id}
                  targetName={profile.username}
                  initialReported={isReportedUser}
                />
              )}
            </div>
          </div>
          {profile.bio && (
            <p className="text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>
          )}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
            {(profile as { groundbreaker?: boolean; groundbreaker_number?: number | null }).groundbreaker && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-300 text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300">
                ⛏️ Groundbreaker {(profile as { groundbreaker_number?: number | null }).groundbreaker_number ? `#${(profile as { groundbreaker_number?: number | null }).groundbreaker_number}` : ""}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={12} />
                {profile.location}
              </span>
            )}
            <span className="text-xs text-muted-foreground">Member since {memberSince}</span>
            {profile.show_follower_count && (followerCount ?? 0) > 0 && (
              <span className="text-xs text-muted-foreground">
                {followerCount} follower{followerCount !== 1 ? "s" : ""}
              </span>
            )}
            {profile.shipping_days && (
              <span className="text-xs text-muted-foreground">
                🚚 Ships within {profile.shipping_days} day{profile.shipping_days !== 1 ? "s" : ""}
              </span>
            )}
          </div>
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
        </div>
      </div>

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">Shop ({listings?.length ?? 0})</TabsTrigger>
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
        </TabsList>

        <TabsContent value="shop" className="mt-6">
          <StorefrontListings
            paymentsEnabled={!!profile.stripe_onboarded}
            listings={(listings ?? []).map(l => ({
              id: l.id,
              plant_name: l.plant_name,
              variety: l.variety ?? null,
              price_cents: l.price_cents,
              images: l.images as string[],
              quantity: l.quantity,
              category: (l as { category?: string | null }).category ?? null,
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
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
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
              <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
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
            {!gardenPlants?.length ? (
              <Card>
                <CardContent className="py-16 text-center space-y-3">
                  <Sprout className="mx-auto text-muted-foreground" size={36} />
                  <p className="font-medium">No plants added yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {gardenPlants.map((plant) => (
                  <Card key={plant.id} className="overflow-hidden h-full">
                    <div className="aspect-square relative bg-muted">
                      {(plant.images as string[])?.[0] ? (
                        <Image src={(plant.images as string[])[0]} alt={plant.name} fill className="object-cover" />
                      ) : (
                        <div className="flex items-center justify-center h-full text-4xl">🪴</div>
                      )}
                    </div>
                    <CardContent className="p-3 space-y-1">
                      <p className="font-semibold text-sm leading-tight">{plant.name}</p>
                      {plant.variety && (
                        <p className="text-xs text-muted-foreground">{plant.variety}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", GARDEN_STATUS_COLOR[plant.status as GardenPlantStatus])}>
                          {GARDEN_STATUS_LABEL[plant.status as GardenPlantStatus]}
                        </span>
                        {plant.location && (
                          <span className="text-xs text-muted-foreground truncate">{plant.location}</span>
                        )}
                      </div>
                      {plant.planted_at && (
                        <p className="text-xs text-muted-foreground">
                          Planted {new Date(plant.planted_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                        </p>
                      )}
                      {(plant as { public_notes?: string | null }).public_notes && (
                        <p className="text-xs text-muted-foreground leading-snug line-clamp-3 pt-0.5 border-t mt-1">
                          {(plant as { public_notes?: string | null }).public_notes}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
