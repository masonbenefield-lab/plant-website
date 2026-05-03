import { notFound } from "next/navigation";
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
import BuyButton from "./buy-button";
import OfferButton from "./offer-button";
import RestockNotifyButton from "./restock-notify-button";
import WishlistButton from "@/components/wishlist-button";
import ReportButton from "@/components/report-button";
import ImageGallery from "@/components/image-gallery";
import TrackView from "@/components/track-view";
import SizePicker from "@/components/size-picker";

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
  const image = (data.images as string[])?.[0];

  return {
    title,
    description,
    openGraph: { title, description, ...(image ? { images: [{ url: image }] } : {}) },
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
    .eq("status", "active")
    .single();

  if (!listing) notFound();

  const [{ data: seller }, { data: { user } }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url, stripe_onboarded, shipping_days, vacation_mode, vacation_until, offers_enabled").eq("id", listing.seller_id).single(),
    supabase.auth.getUser(),
  ]);

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

  const [wishlistRow, reportRow, offerRow, restockRow, { data: relatedListings }] = await Promise.all([
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
  ]);

  const isWishlisted = !!wishlistRow.data;
  const isReported = !!reportRow.data;
  const existingOffer = offerRow.data as { id: string; status: "pending" | "accepted" | "declined" | "withdrawn" } | null;
  const alreadySubscribedRestock = !!restockRow.data;
  const sellerOffersEnabled = (seller as { offers_enabled?: boolean } | null)?.offers_enabled !== false;
  const isSoldOut = listing.status === "sold_out" || listing.quantity <= 0;

  const filteredRelated = (relatedListings ?? []).filter((r) => !siblingIds.has(r.id)).slice(0, 4);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <TrackView listingId={listing.id} />

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
                <span className="inline-block mt-2 text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full">
                  {listing.category}
                </span>
              )}
            </div>
            <WishlistButton userId={user?.id ?? null} listingId={listing.id} initialWishlisted={isWishlisted} />
          </div>
          {(() => {
            const onSale = !!(listing.sale_price_cents && listing.sale_ends_at && new Date(listing.sale_ends_at) > new Date());
            const displayPrice = onSale ? listing.sale_price_cents! : listing.price_cents;
            const saleEndsAt = onSale ? new Date(listing.sale_ends_at!) : null;
            const hoursLeft = saleEndsAt ? Math.ceil((saleEndsAt.getTime() - Date.now()) / 3600000) : null;
            return (
              <div className="mt-4 space-y-1">
                <div className="flex items-center gap-3">
                  <span className={`text-3xl font-bold ${onSale ? "text-red-600" : "text-green-700"}`}>
                    {centsToDisplay(displayPrice)}
                  </span>
                  {onSale && (
                    <span className="text-lg text-muted-foreground line-through">{centsToDisplay(listing.price_cents)}</span>
                  )}
                  {listing.pot_size && showSizePicker && (
                    <span className="text-sm text-muted-foreground font-medium">{listing.pot_size}</span>
                  )}
                  <Badge variant="secondary">{listing.quantity} available</Badge>
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

          {seller?.shipping_days && (
            <p className="mt-3 text-xs text-muted-foreground">
              🚚 Ships within {seller.shipping_days} day{seller.shipping_days !== 1 ? "s" : ""}
            </p>
          )}

          {seller?.vacation_mode && (
            <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
              This seller is on vacation and not currently shipping.
              {seller.vacation_until && ` Expected back ${new Date(seller.vacation_until).toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`}
            </div>
          )}

          <div className="mt-6 space-y-3">
            {!seller?.stripe_onboarded ? (
              <p className="text-sm text-muted-foreground">
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
                  <BuyButton listingId={listing.id} maxQty={listing.quantity} />
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
                  className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800 w-full")}
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

          {seller && (
            <Link
              href={`/sellers/${seller.username}`}
              className="flex items-center gap-3 mt-8 p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={seller.avatar_url ?? undefined} />
                <AvatarFallback className="bg-green-100 text-green-700">
                  {seller.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{seller.username}</p>
                <p className="text-xs text-muted-foreground">View storefront →</p>
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* Related listings */}
      {filteredRelated.length > 0 && (
        <div className="mt-16">
          <h2 className="text-lg font-semibold mb-4">
            More from {seller?.username ?? "this seller"}
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
                  <p className="text-sm font-bold text-green-700 mt-1">
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
