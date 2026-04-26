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
      .select("plant_name, variety, current_bid_cents")
      .eq("id", auctionId)
      .eq("status", "ended")
      .eq("current_bidder_id", user.id)
      .single();
    if (!data) notFound();
    itemName = data.variety ? `${data.plant_name} — ${data.variety}` : data.plant_name;
    priceCents = data.current_bid_cents;
  } else {
    notFound();
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Checkout</h1>
      <p className="text-muted-foreground mb-8">
        {itemName}{quantity > 1 ? ` × ${quantity}` : ""} — <strong>{centsToDisplay(priceCents)}</strong>
      </p>
      <CheckoutForm
        listingId={listingId}
        auctionId={auctionId}
        priceCents={priceCents}
        quantity={quantity}
      />
    </div>
  );
}
