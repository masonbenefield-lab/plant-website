import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "./checkout-form";
import { centsToDisplay } from "@/lib/stripe";
import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string; auction?: string; qty?: string; offer?: string }>;
}) {
  const { listing: listingId, auction: auctionId, qty: qtyParam, offer: offerId } = await searchParams;
  const quantity = Math.max(1, parseInt(qtyParam ?? "1", 10) || 1);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let itemName = "";
  let priceCents = 0;
  let offerNote: string | null = null;
  let buyerNotePrompt: string | null = null;
  let buyerNoteRequired: boolean = false;

  if (listingId) {
    if (offerId) {
      // Offer checkout — validate the accepted offer
      const { data: offer } = await supabase
        .from("offers")
        .select("amount_cents, status, expires_at, buyer_id")
        .eq("id", offerId)
        .eq("listing_id", listingId)
        .single();
      if (!offer || offer.buyer_id !== user.id || offer.status !== "accepted" || new Date(offer.expires_at) < new Date()) {
        notFound();
      }
      const { data: listing } = await supabase
        .from("listings")
        .select("plant_name, variety, price_cents")
        .eq("id", listingId)
        .eq("status", "active")
        .single();
      if (!listing) notFound();
      itemName = listing.variety ? `${listing.plant_name} — ${listing.variety}` : listing.plant_name;
      priceCents = offer.amount_cents;
      offerNote = `Offer accepted — original price was ${centsToDisplay(listing.price_cents)}`;
    } else {
      const { data } = await supabase
        .from("listings")
        .select("plant_name, variety, price_cents, sale_price_cents, sale_ends_at")
        .eq("id", listingId)
        .eq("status", "active")
        .single();
      if (!data) notFound();
      itemName = data.variety ? `${data.plant_name} — ${data.variety}` : data.plant_name;
      const onSale = !!(data.sale_price_cents && data.sale_ends_at && new Date(data.sale_ends_at) > new Date());
      priceCents = (onSale ? data.sale_price_cents! : data.price_cents) * quantity;
      const { data: noteData } = await supabase.from("listings").select("*").eq("id", listingId).single();
      buyerNotePrompt = (noteData as any)?.buyer_note_prompt ?? null;
      buyerNoteRequired = (noteData as any)?.buyer_note_required ?? false;
    }
  } else if (auctionId) {
    if (offerId) {
      // Second-bidder offer — look up the pre-created pending order
      const { data: offerOrder } = await supabase
        .from("orders")
        .select("amount_cents, buyer_id, auction_id, payment_deadline_at")
        .eq("id", offerId)
        .eq("auction_id", auctionId)
        .eq("buyer_id", user.id)
        .eq("status", "pending")
        .single();
      if (!offerOrder) notFound();
      if (offerOrder.payment_deadline_at && new Date(offerOrder.payment_deadline_at) < new Date()) notFound();
      const { data: auctionData } = await supabase
        .from("auctions")
        .select("plant_name, variety")
        .eq("id", auctionId)
        .single();
      if (!auctionData) notFound();
      itemName = auctionData.variety ? `${auctionData.plant_name} — ${auctionData.variety}` : auctionData.plant_name;
      priceCents = offerOrder.amount_cents;
    } else {
      const { data } = await supabase
        .from("auctions")
        .select("plant_name, variety, current_bid_cents, status, ends_at")
        .eq("id", auctionId)
        .eq("current_bidder_id", user.id)
        .single();
      if (!data) notFound();
      const hasEnded = data.status === "ended" || new Date(data.ends_at) <= new Date();
      if (!hasEnded) notFound();
      itemName = data.variety ? `${data.plant_name} — ${data.variety}` : data.plant_name;
      priceCents = data.current_bid_cents;
    }
  } else {
    notFound();
  }

  // Fetch saved shipping address from profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("saved_shipping_address")
    .eq("id", user.id)
    .single();

  const savedAddress = profile?.saved_shipping_address as {
    name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string;
  } | null;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <BackButton className="mb-4" />
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      <div className="rounded-lg border bg-muted/30 p-4 mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order Summary</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{itemName}</p>
            {auctionId && <p className="text-xs text-muted-foreground mt-0.5">Won at auction</p>}
            {offerId && offerNote && <p className="text-xs text-leaf font-medium mt-0.5">✓ {offerNote}</p>}
            {listingId && !offerId && quantity > 1 && <p className="text-xs text-muted-foreground mt-0.5">Qty: {quantity}</p>}
          </div>
          <p className="text-lg font-bold text-leaf shrink-0">{centsToDisplay(priceCents)}</p>
        </div>
        {listingId && !offerId && quantity > 1 && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {centsToDisplay(priceCents / quantity)} × {quantity} = {centsToDisplay(priceCents)}
          </p>
        )}
      </div>

      <CheckoutForm
        listingId={listingId}
        auctionId={auctionId}
        offerId={offerId}
        priceCents={priceCents}
        quantity={quantity}
        savedAddress={savedAddress}
        buyerNotePrompt={buyerNotePrompt}
        buyerNoteRequired={buyerNoteRequired}
      />
    </div>
  );
}
