import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { centsToDisplay } from "@/lib/stripe";
import ReserveOfferActions from "./reserve-offer-actions";

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function ReserveOfferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: auctionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/auctions/${auctionId}/reserve-offer`);

  const admin = adminClient();

  const { data: auction } = await admin
    .from("auctions")
    .select("id, plant_name, images, current_bid_cents, current_bidder_id, seller_id, reserve_offer_status, reserve_offer_expires_at, free_shipping, shipping_cost_cents, shipping_weight_oz")
    .eq("id", auctionId)
    .single();

  if (!auction || auction.current_bidder_id !== user.id) {
    redirect(`/auctions/${auctionId}`);
  }

  // Resolve shipping display
  let shippingLabel = "Free";
  let shippingCents = 0;
  if (!auction.free_shipping) {
    if (auction.shipping_weight_oz) {
      const { data: sel } = await admin
        .from("auction_shipping_selections")
        .select("cost_cents, service, carrier")
        .eq("auction_id", auctionId)
        .eq("bidder_id", user.id)
        .single();
      if (sel) {
        shippingCents = sel.cost_cents;
        shippingLabel = `${sel.carrier ?? ""} ${sel.service ?? ""}`.trim() || "Shipping";
      } else {
        shippingLabel = "Calculated at checkout";
      }
    } else if (auction.shipping_cost_cents) {
      shippingCents = auction.shipping_cost_cents;
      shippingLabel = centsToDisplay(shippingCents);
    }
  }

  const estTotal = auction.current_bid_cents + shippingCents;
  const image = auction.images?.[0] ?? null;

  const offerStatus = auction.reserve_offer_status;
  const expired = auction.reserve_offer_expires_at
    ? new Date(auction.reserve_offer_expires_at) <= new Date()
    : false;

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <p className="text-3xl mb-3">🌿</p>
        <h1 className="text-2xl font-bold mb-1">Reserve Offer</h1>
        <p className="text-muted-foreground text-sm">
          The seller has accepted your bid below the original reserve price.
        </p>
      </div>

      <div className="rounded-2xl border bg-card overflow-hidden mb-6">
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={auction.plant_name} className="w-full h-48 object-cover" />
        )}
        <div className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">{auction.plant_name}</h2>

          {/* Cost breakdown */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your bid</span>
              <span className="font-medium">{centsToDisplay(auction.current_bid_cents)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className={`font-medium ${shippingCents === 0 && auction.free_shipping ? "text-leaf" : ""}`}>
                {auction.free_shipping ? "Free" : shippingLabel}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-muted-foreground text-xs italic">Calculated at settlement</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>Est. Total</span>
              <span>
                {centsToDisplay(estTotal)}
                <span className="text-xs font-normal text-muted-foreground"> + tax</span>
              </span>
            </div>
          </div>

          {auction.reserve_offer_expires_at && offerStatus === "pending" && !expired && (
            <p className="text-xs text-muted-foreground text-center bg-muted rounded-lg px-3 py-2">
              Offer expires{" "}
              {new Date(auction.reserve_offer_expires_at).toLocaleString("en-US", {
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          )}
        </div>
      </div>

      <ReserveOfferActions
        auctionId={auctionId}
        offerStatus={offerStatus ?? null}
        expired={expired}
      />
    </div>
  );
}
