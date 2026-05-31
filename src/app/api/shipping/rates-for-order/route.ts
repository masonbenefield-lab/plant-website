import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getShippingRates } from "@/lib/shippo";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, weightOz } = await request.json() as { orderId: string; weightOz?: number };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  // Verify caller is the seller
  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, shipping_address, listing_id, auction_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const addr = order.shipping_address as {
    name: string; line1: string; line2?: string | null;
    city: string; state: string; zip: string; country: string;
  };

  // Resolve weight: use caller-supplied value, then fall back to listing/auction weight
  let resolvedWeightOz = weightOz && weightOz > 0 ? weightOz : null;

  if (!resolvedWeightOz) {
    if (order.listing_id) {
      const { data: listing } = await supabase
        .from("listings")
        .select("shipping_weight_oz, inventory_id")
        .eq("id", order.listing_id)
        .single();
      if (listing?.inventory_id) {
        const { data: inv } = await supabase
          .from("inventory")
          .select("shipping_weight_oz")
          .eq("id", listing.inventory_id)
          .single();
        resolvedWeightOz = inv?.shipping_weight_oz ?? listing?.shipping_weight_oz ?? 16;
      } else {
        resolvedWeightOz = listing?.shipping_weight_oz ?? 16;
      }
    } else if (order.auction_id) {
      const { data: auction } = await supabase
        .from("auctions")
        .select("shipping_weight_oz")
        .eq("id", order.auction_id)
        .single();
      resolvedWeightOz = auction?.shipping_weight_oz ?? 16;
    } else {
      resolvedWeightOz = 16;
    }
  }

  const { data: seller } = await supabase
    .from("profiles")
    .select("ship_from_address, shipping_services")
    .eq("id", user.id)
    .single();

  if (!seller?.ship_from_address) {
    return NextResponse.json({ error: "Add a ship-from address in Account Settings before purchasing labels." }, { status: 400 });
  }

  const from = {
    ...(seller.ship_from_address as { name: string; street1: string; city: string; state: string; zip: string; country: string; phone?: string }),
    email: user.email ?? "",
  };

  const toAddress = {
    name: addr.name,
    street1: addr.line1,
    street2: addr.line2 ?? null,
    city: addr.city,
    state: addr.state,
    zip: addr.zip,
    country: addr.country,
  };

  if (from.country !== toAddress.country) {
    return NextResponse.json({ error: `This seller only ships within ${from.country}` }, { status: 400 });
  }

  try {
    const rates = await getShippingRates({
      from,
      to: toAddress,
      weightOz: resolvedWeightOz,
      enabledServices: (seller.shipping_services as string[] | null) ?? undefined,
    });

    if (!rates.length) {
      return NextResponse.json({ error: "No shipping rates available for this destination" }, { status: 400 });
    }

    return NextResponse.json({ rates, weightOz: resolvedWeightOz });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch shipping rates";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
