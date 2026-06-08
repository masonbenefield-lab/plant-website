export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import OfferActions from "./offer-actions";

const offerStatusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-[#DFE7D4] text-forest",
  declined: "bg-red-100 text-red-700",
  withdrawn: "bg-muted text-muted-foreground",
};

const tradeStatusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  accepted: "bg-[#DFE7D4] text-forest",
  declined: "bg-red-100 text-red-700",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function OffersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "trades" ? "trades" : "offers";

  // ── Offers tab data ──────────────────────────────────────────────────────────
  const { data: offers } = tab === "offers"
    ? await supabase
        .from("offers")
        .select("id, listing_id, buyer_id, amount_cents, message, status, expires_at, created_at")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const buyerIds = [...new Set((offers ?? []).map((o) => o.buyer_id))];
  const listingIds = [...new Set((offers ?? []).filter((o) => o.listing_id).map((o) => o.listing_id!))];

  const [{ data: buyers }, { data: listingsData }] = tab === "offers" && (buyerIds.length || listingIds.length)
    ? await Promise.all([
        buyerIds.length
          ? supabase.from("profiles").select("id, username").in("id", buyerIds)
          : Promise.resolve({ data: [] }),
        listingIds.length
          ? supabase.from("listings").select("id, plant_name, variety, price_cents").in("id", listingIds)
          : Promise.resolve({ data: [] }),
      ])
    : [{ data: [] }, { data: [] }];

  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));
  const listingMap = Object.fromEntries((listingsData ?? []).map((l) => [l.id, l]));
  const pendingOffers = (offers ?? []).filter((o) => o.status === "pending" && new Date(o.expires_at) > new Date());
  const otherOffers = (offers ?? []).filter((o) => o.status !== "pending" || new Date(o.expires_at) <= new Date());

  // ── Trades tab data ──────────────────────────────────────────────────────────
  const [{ data: receivedTrades }, { data: sentTrades }] = tab === "trades"
    ? await Promise.all([
        supabase
          .from("trade_offers")
          .select("id, proposer_id, offer_description, want_description, status, created_at")
          .eq("recipient_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("trade_offers")
          .select("id, recipient_id, offer_description, want_description, status, created_at")
          .eq("proposer_id", user.id)
          .order("created_at", { ascending: false }),
      ])
    : [{ data: null }, { data: null }];

  const tradePartnerIds = [
    ...new Set([
      ...(receivedTrades ?? []).map((t) => t.proposer_id),
      ...(sentTrades ?? []).map((t) => t.recipient_id),
    ]),
  ];
  const { data: tradeProfiles } = tradePartnerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", tradePartnerIds)
    : { data: [] };
  const tradeProfileMap = Object.fromEntries((tradeProfiles ?? []).map((p) => [p.id, p]));

  const pendingReceived = (receivedTrades ?? []).filter((t) => t.status === "pending");
  const otherReceived = (receivedTrades ?? []).filter((t) => t.status !== "pending");
  const pendingSent = (sentTrades ?? []).filter((t) => t.status === "pending");
  const otherSent = (sentTrades ?? []).filter((t) => t.status !== "pending");
  const hasAnyTrades = (receivedTrades ?? []).length > 0 || (sentTrades ?? []).length > 0;

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
                <p className="mt-2 text-sm italic text-muted-foreground">&quot;{offer.message}&quot;</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(offer.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                {offer.status === "pending" && !expired && (
                  <> · expires {new Date(offer.expires_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <p className="text-lg font-bold text-leaf">{centsToDisplay(offer.amount_cents)}</p>
              <Badge variant="secondary" className={offerStatusColor[displayStatus] ?? ""}>
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

  function renderTrade(
    trade: { id: string; offer_description: string; want_description: string; status: string; created_at: string },
    otherId: string,
    direction: "received" | "sent"
  ) {
    const other = tradeProfileMap[otherId];
    return (
      <Link key={trade.id} href={`/trades/${trade.id}`}>
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground mb-1">
                  {direction === "received" ? "From" : "To"}{" "}
                  <span className="font-medium text-foreground">{other?.username ?? "Unknown"}</span>
                </p>
                <p className="font-semibold text-sm leading-snug truncate">
                  Offering: {trade.offer_description}
                </p>
                <p className="text-sm text-muted-foreground leading-snug truncate">
                  Wants: {trade.want_description}
                </p>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {new Date(trade.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <Badge variant="secondary" className={cn(tradeStatusColor[trade.status] ?? "")}>
                {trade.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </Link>
    );
  }

  const tabClass = (active: boolean) =>
    cn(
      "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
      active
        ? "bg-leaf text-white"
        : "text-muted-foreground hover:text-foreground hover:bg-muted"
    );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Offers & Trades</h1>

      {/* Tabs */}
      <div className="flex gap-2 mb-8">
        <Link href="/dashboard/offers" className={tabClass(tab === "offers")}>
          Offers
        </Link>
        <Link href="/dashboard/offers?tab=trades" className={tabClass(tab === "trades")}>
          Trades
          {pendingReceived.length > 0 && tab !== "trades" && (
            <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold">
              {pendingReceived.length}
            </span>
          )}
        </Link>
      </div>

      {/* ── Offers tab ── */}
      {tab === "offers" && (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Accept an offer to lock in the price — the buyer will get an email to complete checkout.
          </p>
          {!offers?.length ? (
            <p className="text-muted-foreground">No offers yet. Offers from buyers will appear here.</p>
          ) : (
            <div className="space-y-6">
              {pendingOffers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                    Pending ({pendingOffers.length})
                  </h2>
                  <div className="space-y-3">{pendingOffers.map(renderOffer)}</div>
                </div>
              )}
              {otherOffers.length > 0 && (
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">History</h2>
                  <div className="space-y-3">{otherOffers.map(renderOffer)}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Trades tab ── */}
      {tab === "trades" && (
        <>
          <p className="text-sm text-muted-foreground mb-6">
            Plant-for-plant swaps with other growers. Click a trade to view details and chat.
          </p>
          {!hasAnyTrades ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-muted-foreground">No trades yet.</p>
              <Link href="/gardens" className="text-sm text-leaf hover:underline font-medium">
                Browse Gardens →
              </Link>
            </div>
          ) : (
            <div className="space-y-10">
              {(receivedTrades ?? []).length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Received</h2>
                  <div className="space-y-3">
                    {pendingReceived.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">Pending ({pendingReceived.length})</p>
                        {pendingReceived.map((t) => renderTrade(t, t.proposer_id, "received"))}
                      </>
                    )}
                    {otherReceived.length > 0 && (
                      <>
                        {pendingReceived.length > 0 && <p className="text-xs text-muted-foreground font-medium pt-2">History</p>}
                        {otherReceived.map((t) => renderTrade(t, t.proposer_id, "received"))}
                      </>
                    )}
                  </div>
                </section>
              )}
              {(sentTrades ?? []).length > 0 && (
                <section>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Sent</h2>
                  <div className="space-y-3">
                    {pendingSent.length > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium">Pending ({pendingSent.length})</p>
                        {pendingSent.map((t) => renderTrade(t, t.recipient_id, "sent"))}
                      </>
                    )}
                    {otherSent.length > 0 && (
                      <>
                        {pendingSent.length > 0 && <p className="text-xs text-muted-foreground font-medium pt-2">History</p>}
                        {otherSent.map((t) => renderTrade(t, t.recipient_id, "sent"))}
                      </>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
