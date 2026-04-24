import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Star } from "lucide-react";
import { centsToDisplay } from "@/lib/stripe";
import FollowButton from "@/components/follow-button";

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

  const [{ data: listings }, { data: auctions }, { data: ratings }, { count: followerCount }] =
    await Promise.all([
      supabase.from("listings").select("*").eq("seller_id", profile.id).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("auctions").select("*").eq("seller_id", profile.id).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("ratings").select("*").eq("seller_id", profile.id).order("created_at", { ascending: false }),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("seller_id", profile.id),
    ]);

  const reviewerIds = [...new Set(ratings?.map((r) => r.reviewer_id) ?? [])];
  const { data: reviewers } = reviewerIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", reviewerIds)
    : { data: [] };
  const reviewerMap = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r]));

  const isFollowing = user
    ? !!(await supabase.from("follows").select("id").eq("follower_id", user.id).eq("seller_id", profile.id).maybeSingle()).data
    : false;

  const avgScore =
    ratings && ratings.length > 0
      ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
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
              <h1 className="text-2xl font-bold">{profile.username}</h1>
              {followerCount != null && followerCount > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">{followerCount} follower{followerCount !== 1 ? "s" : ""}</p>
              )}
            </div>
            <FollowButton
              userId={user?.id ?? null}
              sellerId={profile.id}
              initialFollowing={isFollowing}
              initialCount={followerCount ?? 0}
            />
          </div>
          {profile.bio && (
            <p className="text-muted-foreground mt-2 max-w-lg">{profile.bio}</p>
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
        </div>
      </div>

      <Tabs defaultValue="shop">
        <TabsList>
          <TabsTrigger value="shop">Shop ({listings?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="auctions">Auctions ({auctions?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({ratings?.length ?? 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="shop" className="mt-6">
          {!listings?.length ? (
            <p className="text-muted-foreground">No active listings.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <Link key={listing.id} href={`/shop/${listing.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    {listing.images[0] && (
                      <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                        <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      {"category" in listing && listing.category && (
                        <span className="inline-block text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full mb-1.5">
                          {listing.category}
                        </span>
                      )}
                      <p className="font-semibold">{listing.plant_name}</p>
                      {listing.variety && (
                        <p className="text-sm text-muted-foreground">{listing.variety}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-green-700">
                          {centsToDisplay(listing.price_cents)}
                        </span>
                        <Badge variant="secondary">{listing.quantity} avail.</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="auctions" className="mt-6">
          {!auctions?.length ? (
            <p className="text-muted-foreground">No active auctions.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {auctions.map((auction) => (
                <Link key={auction.id} href={`/auctions/${auction.id}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer">
                    {auction.images[0] && (
                      <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                        <Image src={auction.images[0]} alt={auction.plant_name} fill className="object-cover" />
                      </div>
                    )}
                    <CardContent className="p-4">
                      {"category" in auction && auction.category && (
                        <span className="inline-block text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full mb-1.5">
                          {auction.category}
                        </span>
                      )}
                      <p className="font-semibold">{auction.plant_name}</p>
                      {auction.variety && (
                        <p className="text-sm text-muted-foreground">{auction.variety}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-green-700">
                          Current: {centsToDisplay(auction.current_bid_cents)}
                        </span>
                        <Badge>Live</Badge>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
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
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
