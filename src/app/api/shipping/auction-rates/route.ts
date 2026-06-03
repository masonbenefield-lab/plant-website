import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getShippingRates } from "@/lib/shippo";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const auctionId = searchParams.get("auctionId");
  if (!auctionId) return NextResponse.json({ error: "Missing auctionId" }, { status: 400 });

  const admin = adminClient();

  const { data: auction } = await admin
    .from("auctions")
    .select("shipping_weight_oz, box_length_in, box_width_in, box_height_in, seller_id")
    .eq("id", auctionId)
    .single();

  if (!auction?.shipping_weight_oz) {
    return NextResponse.json({ error: "Auction does not use weight-based shipping" }, { status: 400 });
  }

  const { data: seller } = await admin
    .from("profiles")
    .select("ship_from_address, shipping_services")
    .eq("id", auction.seller_id)
    .single();

  if (!seller?.ship_from_address) {
    return NextResponse.json({ error: "Seller has no ship-from address" }, { status: 400 });
  }

  const { data: buyer } = await admin
    .from("profiles")
    .select("saved_shipping_address")
    .eq("id", user.id)
    .single();

  if (!buyer?.saved_shipping_address) {
    return NextResponse.json({ error: "Add a shipping address to your account before bidding" }, { status: 400 });
  }

  const from = seller.ship_from_address as {
    name: string; street1: string; city: string; state: string; zip: string; country: string;
  };
  const to = buyer.saved_shipping_address as {
    name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string;
  };

  const rates = await getShippingRates({
    from,
    to: { name: to.name, street1: to.line1, street2: to.line2, city: to.city, state: to.state, zip: to.zip, country: to.country },
    weightOz: auction.shipping_weight_oz,
    enabledServices: seller.shipping_services ?? undefined,
    lengthIn: auction.box_length_in,
    widthIn: auction.box_width_in,
    heightIn: auction.box_height_in,
  });

  return NextResponse.json({ rates });
}
