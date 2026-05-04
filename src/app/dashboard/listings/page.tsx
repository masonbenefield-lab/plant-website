export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { centsToDisplay } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/pagination";
import ListingActions from "./listing-actions";
import PauseAllButton from "./pause-all-button";
import ResumeButton from "./resume-button";

const PAGE_SIZE = 25;

export default async function DashboardListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, stripe_onboarded")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/listings");
  }

  const stripeOnboarded = !!profile?.stripe_onboarded;

  const { data: listings, count } = await supabase
    .from("listings")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <div className="flex items-center gap-2">
          <PauseAllButton sellerId={user.id} />
          <Link href="/dashboard/inventory" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
            Create from Inventory →
          </Link>
        </div>
      </div>
      {!stripeOnboarded && !!listings?.length && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Your listings are not visible to buyers yet.</strong> They appear on your personal storefront, but won&apos;t show in the public shop and cannot be purchased until you{" "}
          <a href="/account#seller-payments" className="underline font-medium hover:opacity-80">connect your Stripe account</a>.
        </div>
      )}
      <p className="text-sm text-muted-foreground mb-6">To create a new listing, open an inventory item and click "List in Shop".</p>

      {!listings?.length ? (
        <p className="text-muted-foreground">No listings yet.</p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (

            <Card key={listing.id}>
              <CardContent className="p-4 flex items-center gap-4">
                {/* Photo thumbnail */}
                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-green-50 border">
                  {listing.images?.[0] ? (
                    <Image
                      src={listing.images[0]}
                      alt={listing.plant_name}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{listing.plant_name}</span>
                    {listing.variety && (
                      <span className="text-sm text-muted-foreground">— {listing.variety}</span>
                    )}
                    <Badge
                      variant={listing.status === "active" ? "default" : "secondary"}
                      className={listing.status === "active" ? "bg-green-700" : ""}
                    >
                      {listing.status}
                    </Badge>
                    {listing.status === "paused" && (
                      <ResumeButton listingId={listing.id} />
                    )}
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{centsToDisplay(listing.price_cents)}</span>
                    <span>{listing.quantity} in stock</span>
                    {listing.images?.length > 0 && (
                      <span>{listing.images.length} photo{listing.images.length !== 1 ? "s" : ""}</span>
                    )}
                  </div>
                </div>
                <ListingActions listing={listing} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        prevHref={page > 1 ? `/dashboard/listings?page=${page - 1}` : null}
        nextHref={page < totalPages ? `/dashboard/listings?page=${page + 1}` : null}
      />
    </div>
  );
}
