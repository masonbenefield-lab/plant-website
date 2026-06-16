import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import ListingActions from "./listing-actions";
import OfferButton from "./offer-button";
import RestockNotifyButton from "./restock-notify-button";
import WishlistButton from "@/components/wishlist-button";
import ReportButton from "@/components/report-button";
import ImageGallery from "@/components/image-gallery";
import TrackView from "@/components/track-view";
import SizePicker from "@/components/size-picker";
import ListingShareButton from "@/components/listing-share-button";
import { ListingComments } from "@/components/listing-comments";
import { ShippingEstimate } from "@/components/shipping-estimate";
import { ReturnPolicyBadge } from "@/components/return-policy-badge";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select("plant_name, variety, description, images, price_cents")
    .eq("id", id)
    .single();

  if (!data) return { title: "Listing Not Found — Plantet" };

  const title = data.variety
    ? `${data.plant_name} ${data.variety} — Plantet`
    : `${data.plant_name} — Plantet`;
  const description = data.description || `Buy ${data.plant_name} on Plantet for ${centsToDisplay(data.price_cents)}`;
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.com").replace(/\/$/, "");

  const ogImageUrl = `${siteUrl}/api/og?type=listing&id=${id}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${siteUrl}/shop/${id}`,
      siteName: "Plantet",
      type: "website",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (!listing) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-10">
        <Link href="/shop" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back to Shop
        </Link>
        <div className="text-center py-24">
          <p className="text-5xl mb-4">🌿</p>
          <h1 className="text-2xl font-bold mb-2">Listing no longer available</h1>
          <p className="text-muted-foreground mb-6">This listing may have been removed by the seller.</p>
          <Link href="/shop" className="inline-block bg-leaf text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-forest transition-colors">
            Browse the Shop →
          </Link>
        </div>
      </div>
    );
  }

  const [{ data: seller }, { data: { user } }, { data: invShipping }, { data: sellerRatings }] = await Promise.all([
    supabase.from("profiles").select("id, username, display_name, avatar_url, bio, stripe_onboarded, shipping_days, shipping_days_max, return_policy_type, return_policy_notes, vacation_mode, vacation_until, offers_enabled, calculated_shipping_enabled").eq("id", listing.seller_id).single(),
    supabase.auth.getUser(),
    listing.inventory_id
      ? supabase.from("inventory").select("free_shipping, shipping_cost_cents, shipping_weight_oz").eq("id", listing.inventory_id).single()
      : Promise.resolve({ data: null }),
    supabase.from("ratings").select("score").eq("seller_id", listing.seller_id),
  ]);

  const shippingFree = invShipping?.free_shipping ?? listing.free_shipping;
  const shippingCostCents = invShipping?.shipping_cost_cents ?? listing.shipping_cost_cents;

  // Sibling listings: same seller + plant_name + variety, different sizes
  let siblingQuery = supabase
    .from("listings")
    .select("id, pot_size, price_cents, quantity")
    .eq("seller_id", listing.seller_id)
    .eq("plant_name", listing.plant_name)
    .eq("status", "active");
  siblingQuery = listing.variety
    ? siblingQuery.eq("variety", listing.variety)
    : siblingQuery.is("variety", null);
  const { data: sizeSiblings } = await siblingQuery.order("pot_size");

  const siblingIds = new Set((sizeSiblings ?? []).map((s) => s.id));
  const showSizePicker = (sizeSiblings ?? []).length > 1;

  const [wishlistRow, reportRow, offerRow, restockRow, { data: relatedListings }, { data: rawComments }] = await Promise.all([
    user ? supabase.from("wishlists").select("id").eq("user_id", user.id).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("reports").select("id").eq("reporter_id", user.id).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("offers").select("id, status").eq("buyer_id", user.id).eq("listing_id", listing.id).in("status", ["pending", "accepted"]).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("restock_notifications").select("id").eq("listing_id", listing.id).eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase
      .from("listings")
      .select("id, plant_name, variety, price_cents, images, category")
      .eq("seller_id", listing.seller_id)
      .eq("status", "active")
      .neq("id", listing.id)
      .limit(8),
    supabase
      .from("listing_comments")
      .select("id, body, created_at, user_id")
      .eq("listing_id", listing.id)
      .order("created_at", { ascending: false }),
  ]);

  const isWishlisted = !!wishlistRow.data;
  const isReported = !!reportRow.data;
  const existingOffer = offerRow.data as { id: string; status: "pending" | "accepted" | "declined" | "withdrawn" } | null;
  const alreadySubscribedRestock = !!restockRow.data;
  const sellerOffersEnabled = (seller as { offers_enabled?: boolean } | null)?.offers_enabled !== false;
  const isSoldOut = listing.status === "sold_out" || (listing.status !== "paused" && listing.quantity <= 0);
  const isPaused = listing.status === "paused";

  const filteredRelated = (relatedListings ?? []).filter((r) => !siblingIds.has(r.id)).slice(0, 4);

  // Fetch commenter profiles
  const commenterIds = [...new Set((rawComments ?? []).map((c) => c.user_id))];
  const { data: commenters } = commenterIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", commenterIds)
    : { data: [] };
  const commenterMap = Object.fromEntries((commenters ?? []).map((p) => [p.id, p]));
  const comments = (rawComments ?? []).map((c) => ({
    ...c,
    username: commenterMap[c.user_id]?.username ?? "unknown",
    avatar_url: commenterMap[c.user_id]?.avatar_url ?? null,
  }));

  const siteUrl = "https://www.plantet.shop";
  const ratingCount = sellerRatings?.length ?? 0;
  const avgRating = ratingCount > 0
    ? (sellerRatings!.reduce((s, r) => s + r.score, 0) / ratingCount).toFixed(1)
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: listing.variety ? `${listing.plant_name} ${listing.variety}` : listing.plant_name,
    description: listing.description ?? undefined,
    image: (listing.images as string[]).slice(0, 3),
    offers: {
      "@type": "Offer",
      priceCurrency: "USD",
      price: ((listing.price_cents as number) / 100).toFixed(2),
      availability: isSoldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      url: `${siteUrl}/shop/${listing.id}`,
      seller: { "@type": "Organization", name: seller?.display_name ?? seller?.username ?? "Plantet Seller" },
    },
    ...(avgRating && ratingCount >= 3 ? {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: avgRating,
        reviewCount: ratingCount,
      },
    } : {}),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TrackView listingId={listing.id} />
      <Link href={listing.item_type === "supply" ? "/shop?tab=supplies" : "/shop"} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
        {listing.item_type === "supply" ? "Back to Garden Supplies" : "Back to Shop"}
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <ImageGallery images={listing.images as string[]} alt={listing.plant_name} />

        {/* Details */}
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">{listing.plant_name}</h1>
              {listing.variety && (
                <p className="text-muted-foreground mt-1">{listing.variety}</p>
              )}
              {listing.category && (
                <span className="inline-block mt-2 text-xs font-medium text-leaf dark:text-sage bg-[#DFE7D4] dark:bg-forest/40 px-2 py-0.5 rounded-full">
                  {listing.category}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <ListingShareButton title={listing.plant_name} />
              <WishlistButton userId={user?.id ?? null} listingId={listing.id} initialWishlisted={isWishlisted} />
            </div>
          </div>
          {(() => {
            const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
            const displayPrice = onSale ? listing.sale_price_cents! : listing.price_cents;
            const saleEndsAt = onSale ? new Date(listing.sale_ends_at!) : null;
            const hoursLeft = saleEndsAt ? Math.ceil((saleEndsAt.getTime() - Date.now()) / 3600000) : null;
            return (
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${onSale ? "text-red-600" : "text-leaf"}`}>
                    {centsToDisplay(displayPrice)}
                  </span>
                  {onSale && (
                    <span className="text-lg text-muted-foreground line-through">{centsToDisplay(listing.price_cents)}</span>
                  )}
                  {listing.pot_size && showSizePicker && (
                    <span className="text-sm text-muted-foreground font-medium">{listing.pot_size}</span>
                  )}
                  <Badge variant="secondary">{listing.quantity} available</Badge>
                  {(listing as { bundle_discount_pct?: number | null }).bundle_discount_pct && (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      {(listing as { bundle_discount_pct: number }).bundle_discount_pct}% off 2+
                    </Badge>
                  )}
                </div>
                {onSale && hoursLeft !== null && (
                  <p className="text-xs font-medium text-red-600">
                    🏷️ Sale ends in {hoursLeft < 1 ? "less than an hour" : hoursLeft < 24 ? `${hoursLeft}h` : `${Math.ceil(hoursLeft / 24)} day${Math.ceil(hoursLeft / 24) !== 1 ? "s" : ""}`}
                  </p>
                )}
              </div>
            );
          })()}

          {showSizePicker && (
            <div className="mt-5">
              <SizePicker siblings={sizeSiblings!} currentId={listing.id} />
            </div>
          )}

          {listing.description && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          )}

          <div className="mt-3 space-y-1.5">
            {seller?.shipping_days && (
              <p className="text-xs text-muted-foreground">
                🚚 Ships within {seller.shipping_days}{(seller as { shipping_days_max?: number | null }).shipping_days_max ? `–${(seller as { shipping_days_max?: number | null }).shipping_days_max}` : ""} day{((seller as { shipping_days_max?: number | null }).shipping_days_max ?? seller.shipping_days) !== 1 ? "s" : ""}
              </p>
            )}
            {(seller as { return_policy_type?: string | null } | null)?.return_policy_type && (
              <ReturnPolicyBadge
                type={(seller as { return_policy_type: string }).return_policy_type}
                notes={(seller as { return_policy_notes?: string | null }).return_policy_notes}
              />
            )}
            <ShippingEstimate
              freeShipping={shippingFree}
              shippingCostCents={shippingCostCents}
            />
          </div>

          {seller?.vacation_mode && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              This seller is on vacation and not currently shipping.
              {seller.vacation_until && ` Expected back ${new Date(seller.vacation_until).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {isPaused ? (
              <p className="text-sm font-medium text-muted-foreground">This item is not currently available.</p>
            ) : !seller?.stripe_onboarded ? (
              <p className="text-sm text-muted-foreground" aria-hidden="true">
                This seller has not set up payments yet.
              </p>
            ) : isSoldOut ? (
              <>
                <p className="text-sm font-medium text-muted-foreground">This item is sold out.</p>
                <RestockNotifyButton
                  listingId={listing.id}
                  isLoggedIn={!!user}
                  alreadySubscribed={alreadySubscribedRestock}
                />
              </>
            ) : user ? (
              user.id === seller?.id ? (
                <Button disabled variant="outline">This is your listing</Button>
              ) : (
                <>
                  <ListingActions
                    listingId={listing.id}
                    maxQty={listing.quantity}
                    plantName={listing.plant_name}
                    variety={listing.variety ?? null}
                    priceCents={listing.price_cents}
                    imageUrl={(listing.images as string[])?.[0] ?? null}
                    sellerId={listing.seller_id}
                    sellerUsername={seller?.username ?? ""}
                    sellerDisplayName={seller?.display_name ?? seller?.username ?? ""}
                    bundleDiscountPct={(listing as { bundle_discount_pct?: number | null }).bundle_discount_pct ?? null}
                    buyerNotePrompt={(listing as any).buyer_note_prompt ?? null}
                    buyerNoteRequired={(listing as any).buyer_note_required ?? false}
                  />
                  {sellerOffersEnabled && (
                    <OfferButton
                      listingId={listing.id}
                      listingPriceCents={listing.price_cents}
                      existingOfferStatus={existingOffer?.status ?? null}
                    />
                  )}
                </>
              )
            ) : (
              <>
                <Link
                  href={`/login?redirectTo=/shop/${listing.id}`}
                  className={cn(buttonVariants(), "bg-leaf hover:bg-forest w-full")}
                >
                  Sign in to buy
                </Link>
                <RestockNotifyButton
                  listingId={listing.id}
                  isLoggedIn={false}
                  alreadySubscribed={false}
                />
              </>
            )}
          </div>

          {user && user.id !== listing.seller_id && (
            <div className="mt-6 flex justify-end">
              <ReportButton
                userId={user.id}
                listingId={listing.id}
                targetName={listing.plant_name}
                initialReported={isReported}
              />
            </div>
          )}

          {seller && (() => {
            const ratingCount = sellerRatings?.length ?? 0;
            const avgRating = ratingCount > 0
              ? (sellerRatings!.reduce((s, r) => s + r.score, 0) / ratingCount).toFixed(1)
              : null;
            return (
              <Link
                href={`/sellers/${seller.username}`}
                className="block mt-8 p-4 rounded-lg border hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarImage src={seller.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-[#DFE7D4] text-leaf">
                      {(seller.display_name ?? seller.username).slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{seller.display_name ?? seller.username}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {avgRating && (
                        <span className="text-xs text-amber-600 dark:text-amber-400">★ {avgRating} ({ratingCount})</span>
                      )}
                      <span className="text-xs text-muted-foreground">View storefront →</span>
                    </div>
                  </div>
                </div>
                {(seller as { bio?: string | null }).bio && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{(seller as { bio?: string | null }).bio}</p>
                )}
              </Link>
            );
          })()}
        </div>
      </div>

      {/* Comments */}
      <ListingComments
        listingId={listing.id}
        sellerId={listing.seller_id}
        currentUserId={user?.id ?? null}
        initialComments={comments}
      />

      {/* Related listings */}
      {filteredRelated.length > 0 && (
        <div className="mt-16">
          <h2 className="text-lg font-semibold mb-4">
            More from {seller ? (seller.display_name ?? seller.username) : "this seller"}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {filteredRelated.map((item) => (
              <Link
                key={item.id}
                href={`/shop/${item.id}`}
                className="rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-card"
              >
                <div className="relative h-36 bg-muted">
                  {(item.images as string[])[0] ? (
                    <Image
                      src={(item.images as string[])[0]}
                      alt={item.plant_name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-3xl">🌿</div>
                  )}
                </div>
                <CardContent className="p-3">
                  <p className="text-sm font-medium truncate">{item.plant_name}</p>
                  {item.variety && (
                    <p className="text-xs text-muted-foreground truncate">{item.variety}</p>
                  )}
                  <p className="text-sm font-bold text-leaf mt-1">
                    {centsToDisplay(item.price_cents)}
                  </p>
                </CardContent>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
