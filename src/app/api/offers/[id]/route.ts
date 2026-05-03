import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOfferAccepted, sendOfferDeclined } from "@/lib/email";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { action } = await request.json() as { action: "accept" | "decline" | "withdraw" };
  if (!["accept", "decline", "withdraw"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = adminClient();
  const { data: offerData, error } = await admin
    .from("offers")
    .select("id, listing_id, buyer_id, seller_id, amount_cents, status, expires_at")
    .eq("id", id)
    .single();

  type OfferRow = Database["public"]["Tables"]["offers"]["Row"];
  const offer = offerData as OfferRow | null;

  if (error || !offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.status !== "pending") return NextResponse.json({ error: "Offer is no longer pending" }, { status: 409 });
  if (new Date(offer.expires_at) < new Date()) {
    await admin.from("offers").update({ status: "declined" }).eq("id", id);
    return NextResponse.json({ error: "Offer has expired" }, { status: 410 });
  }

  if (action === "withdraw") {
    if (offer.buyer_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await admin.from("offers").update({ status: "withdrawn" }).eq("id", id);
    return NextResponse.json({ success: true });
  }

  // accept / decline — seller only
  if (offer.seller_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const newStatus = action === "accept" ? "accepted" : "declined";
  await admin.from("offers").update({ status: newStatus }).eq("id", id);

  // When accepting, decline all other pending offers for this listing
  if (action === "accept") {
    await admin
      .from("offers")
      .update({ status: "declined" })
      .eq("listing_id", offer.listing_id)
      .eq("status", "pending")
      .neq("id", id);
  }

  // Fetch listing name for email
  const { data: listingData } = await admin
    .from("listings")
    .select("plant_name")
    .eq("id", offer.listing_id)
    .single();
  const plantName = (listingData as { plant_name: string } | null)?.plant_name ?? "your plant";

  // Email the buyer
  const { data: buyerAuth } = await admin.auth.admin.getUserById(offer.buyer_id);
  const buyerEmail = buyerAuth?.user?.email;

  if (buyerEmail) {
    if (action === "accept") {
      await sendOfferAccepted({
        buyerEmail,
        plantName,
        amountCents: offer.amount_cents,
        checkoutUrl: `${process.env.NEXT_PUBLIC_APP_URL}/checkout?listing=${offer.listing_id}&offer=${id}`,
      }).catch(() => {});
    } else {
      await sendOfferDeclined({
        buyerEmail,
        plantName,
        listingUrl: `${process.env.NEXT_PUBLIC_APP_URL}/shop/${offer.listing_id}`,
      }).catch(() => {});
    }
  }

  return NextResponse.json({ success: true });
}
