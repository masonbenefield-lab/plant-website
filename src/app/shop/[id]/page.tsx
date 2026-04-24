import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { centsToDisplay } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import BuyButton from "./buy-button";
import WishlistButton from "@/components/wishlist-button";
import ReportButton from "@/components/report-button";

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
    supabase.from("profiles").select("id, username, avatar_url, stripe_onboarded").eq("id", listing.seller_id).single(),
    supabase.auth.getUser(),
  ]);

  const [wishlistRow, reportRow] = await Promise.all([
    user ? supabase.from("wishlists").select("id").eq("user_id", user.id).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
    user ? supabase.from("reports").select("id").eq("reporter_id", user.id).eq("listing_id", listing.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const isWishlisted = !!wishlistRow.data;
  const isReported = !!reportRow.data;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
        {/* Images */}
        <div className="space-y-3">
          <div className="relative h-96 rounded-xl overflow-hidden bg-muted">
            {listing.images[0] ? (
              <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-6xl">🌿</div>
            )}
          </div>
          {listing.images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {listing.images.slice(1).map((url, i) => (
                <div key={i} className="relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden">
                  <Image src={url} alt="" fill className="object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

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
          <div className="flex items-center gap-3 mt-4">
            <span className="text-3xl font-bold text-green-700">
              {centsToDisplay(listing.price_cents)}
            </span>
            <Badge variant="secondary">{listing.quantity} available</Badge>
          </div>

          {listing.description && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">
              {listing.description}
            </p>
          )}

          <div className="mt-6">
            {!seller?.stripe_onboarded ? (
              <p className="text-sm text-muted-foreground">
                This seller has not set up payments yet.
              </p>
            ) : user ? (
              user.id === seller?.id ? (
                <Button disabled variant="outline">This is your listing</Button>
              ) : (
                <BuyButton listingId={listing.id} />
              )
            ) : (
              <Link
                href={`/login?redirectTo=/shop/${listing.id}`}
                className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800 w-full")}
              >
                Sign in to buy
              </Link>
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
    </div>
  );
}
