import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckoutForm from "./checkout-form";
import { centsToDisplay } from "@/lib/stripe";
import { notFound } from "next/navigation";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ listing?: string; auction?: string; qty?: string }>;
}) {
  const { listing: listingId, auction: auctionId, qty: qtyParam } = await searchParams;
  const quantity = Math.max(1, parseInt(qtyParam ?? "1", 10) || 1);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let itemName = "";
  let priceCents = 0;

  if (listingId) {
    const { data } = await supabase
      .from("listings")
      .select("plant_name, variety, price_cents")
      .eq("id", listingId)
      .eq("status", "active")
      .single();
    if (!data) notFound();
    itemName = data.variety ? `${data.plant_name} — ${data.variety}` : data.plant_name;
    priceCents = data.price_cents * quantity;
  } else if (auctionId) {
    const { data } = await supabase
      .from("auctions")
      .select("plant_name, variety, current_bid_cents, status, ends_at")
      .eq("id", auctionId)
      .eq("current_bidder_id", user.id)
      .single();
    if (!data) notFound();
    // Allow checkout once auction has ended by status OR time has elapsed
    const hasEnded = data.status === "ended" || new Date(data.ends_at) <= new Date();
    if (!hasEnded) notFound();
    itemName = data.variety ? `${data.plant_name} — ${data.variety}` : data.plant_name;
    priceCents = data.current_bid_cents;
  } else {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Checkout</h1>

      {/* Order summary */}
      <div className="rounded-lg border bg-muted/30 p-4 mb-8 space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Order Summary</p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold">{itemName}</p>
            {auctionId && <p className="text-xs text-muted-foreground mt-0.5">Won at auction</p>}
            {listingId && quantity > 1 && <p className="text-xs text-muted-foreground mt-0.5">Qty: {quantity}</p>}
          </div>
          <p className="text-lg font-bold text-green-700 shrink-0">{centsToDisplay(priceCents)}</p>
        </div>
        {listingId && quantity > 1 && (
          <p className="text-xs text-muted-foreground border-t pt-2">
            {centsToDisplay(priceCents / quantity)} × {quantity} = {centsToDisplay(priceCents)}
          </p>
        )}
      </div>

      <CheckoutForm
        listingId={listingId}
        auctionId={auctionId}
        priceCents={priceCents}
        quantity={quantity}
      />
    </div>
  );
}
