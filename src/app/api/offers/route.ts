import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { sendOfferReceived } from "@/lib/email";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`offer:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { listingId, amountDollars, message } = await request.json() as {
    listingId: string;
    amountDollars: string;
    message?: string;
  };

  if (!listingId || !amountDollars) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const amountCents = Math.round(parseFloat(amountDollars) * 100);
  if (isNaN(amountCents) || amountCents < 100) {
    return NextResponse.json({ error: "Offer must be at least $1.00" }, { status: 400 });
  }

  const { data: listing, error: listingError } = await supabase
    .from("listings")
    .select("id, seller_id, plant_name, price_cents, status")
    .eq("id", listingId)
    .eq("status", "active")
    .single();

  if (listingError || !listing) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  }

  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: "You cannot make an offer on your own listing" }, { status: 400 });
  }

  if (amountCents >= listing.price_cents) {
    return NextResponse.json({ error: "Offer must be less than the listing price — just buy it instead!" }, { status: 400 });
  }

  const { data: sellerProfile } = await supabase
    .from("profiles")
    .select("offers_enabled, username")
    .eq("id", listing.seller_id)
    .single();

  if (sellerProfile?.offers_enabled === false) {
    return NextResponse.json({ error: "This seller is not accepting offers" }, { status: 400 });
  }

  // Check for existing pending offer from this buyer
  const { data: existing } = await supabase
    .from("offers")
    .select("id, status")
    .eq("listing_id", listingId)
    .eq("buyer_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending offer on this listing" }, { status: 409 });
  }

  const { data: offer, error } = await supabase
    .from("offers")
    .insert({
      listing_id: listingId,
      buyer_id: user.id,
      seller_id: listing.seller_id,
      amount_cents: amountCents,
      message: message?.trim() || null,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Email seller
  const { data: sellerAuth } = await supabase.auth.admin.getUserById(listing.seller_id).catch(() => ({ data: null }));
  const sellerEmail = (sellerAuth as { user?: { email?: string } } | null)?.user?.email;
  const { data: buyerProfile } = await supabase.from("profiles").select("username").eq("id", user.id).single();

  if (sellerEmail) {
    await sendOfferReceived({
      sellerEmail,
      sellerUsername: sellerProfile?.username ?? "Seller",
      buyerUsername: buyerProfile?.username ?? "A buyer",
      plantName: listing.plant_name,
      amountCents,
      message: message?.trim() || null,
      offerId: offer.id,
    }).catch(() => {});
  }

  return NextResponse.json({ offerId: offer.id });
}
