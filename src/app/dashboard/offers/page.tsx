export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import OfferActions from "./offer-actions";

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-green-100 text-green-800",
  declined: "bg-red-100 text-red-700",
  withdrawn: "bg-muted text-muted-foreground",
};

export default async function OffersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: offers } = await supabase
    .from("offers")
    .select("id, listing_id, buyer_id, amount_cents, message, status, expires_at, created_at")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  const buyerIds = [...new Set((offers ?? []).map((o) => o.buyer_id))];
  const listingIds = [...new Set((offers ?? []).filter((o) => o.listing_id).map((o) => o.listing_id!))];

  const [{ data: buyers }, { data: listingsData }] = await Promise.all([
    buyerIds.length
      ? supabase.from("profiles").select("id, username").in("id", buyerIds)
      : Promise.resolve({ data: [] }),
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety, price_cents").in("id", listingIds)
      : Promise.resolve({ data: [] }),
  ]);

  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));
  const listingMap = Object.fromEntries((listingsData ?? []).map((l) => [l.id, l]));

  const pending = (offers ?? []).filter((o) => o.status === "pending" && new Date(o.expires_at) > new Date());
  const other = (offers ?? []).filter((o) => o.status !== "pending" || new Date(o.expires_at) <= new Date());

  function renderOffer(offer: NonNullable<typeof offers>[0]) {
    const listing = offer.listing_id ? listingMap[offer.listing_id] ?? null : null;
    const buyer = buyerMap[offer.buyer_id];
    const expired = new Date(offer.expires_at) < new Date();
    const displayStatus = expired && offer.status === "pending" ? "expired" : offer.status;

    return (
      <Card key={offer.id}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="font-semibold">
                {listing?.plant_name}{listing?.variety ? ` — ${listing.variety}` : ""}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                From <span className="font-medium text-foreground">{buyer?.username ?? "Unknown"}</span>
                {" · "}Listed at {centsToDisplay(listing?.price_cents ?? 0)}
              </p>
              {offer.message && (
                <p className="mt-2 text-sm italic text-muted-foreground">"{offer.message}"</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(offer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {offer.status === "pending" && !expired && (
                  <> · expires {new Date(offer.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-green-700">{centsToDisplay(offer.amount_cents)}</p>
              <Badge
                variant="secondary"
                className={statusColor[displayStatus] ?? ""}
              >
                {displayStatus}
              </Badge>
            </div>
          </div>
          {offer.status === "pending" && !expired && (
            <div className="mt-4 pt-3 border-t">
              <OfferActions offerId={offer.id} />
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Offers Received</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Accept an offer to lock in the price — the buyer will get an email to complete checkout.
      </p>

      {!offers?.length ? (
        <p className="text-muted-foreground">No offers yet. Offers from buyers will appear here.</p>
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Pending ({pending.length})</h2>
              <div className="space-y-3">{pending.map(renderOffer)}</div>
            </div>
          )}
          {other.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">History</h2>
              <div className="space-y-3">{other.map(renderOffer)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
