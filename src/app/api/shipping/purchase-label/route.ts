import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { purchaseLabel, getShippingRates } from "@/lib/shippo";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, rateId } = await request.json() as { orderId: string; rateId?: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const admin = adminClient();

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, shippo_rate_id, shippo_transaction_id, label_url, shipping_address, shipping_service, auction_id, listing_id")
    .eq("id", orderId)
    .eq("seller_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.label_url) {
    return NextResponse.json({ labelUrl: order.label_url });
  }

  const effectiveRateId = rateId ?? order.shippo_rate_id;
  if (!effectiveRateId) {
    return NextResponse.json({ error: "No rate selected" }, { status: 400 });
  }

  // Try stored rate first, fall back to fresh shipment if it fails (expired or email issue)
  async function tryPurchase(rid: string) {
    const result = await purchaseLabel(rid);
    await admin.from("orders").update({
      shippo_transaction_id: result.transactionId,
      tracking_number: result.trackingNumber,
      label_url: result.labelUrl,
      status: "shipped",
    }).eq("id", orderId);
    return result;
  }

  try {
    const result = await tryPurchase(effectiveRateId);
    return NextResponse.json({ labelUrl: result.labelUrl, trackingNumber: result.trackingNumber });
  } catch {
    // Stored rate failed (expired or missing email on shipment) — rebuild shipment and retry
    try {
      const shippingAddr = order.shipping_address as Record<string, string> | null;
      if (!shippingAddr) return NextResponse.json({ error: "No shipping address on order" }, { status: 400 });

      // Fetch item details for weight/dimensions
      let weightOz = 16;
      let lengthIn: number | null = null;
      let widthIn: number | null = null;
      let heightIn: number | null = null;
      let packageType: string | null = null;

      if (order.auction_id) {
        const { data: auction } = await admin.from("auctions")
          .select("shipping_weight_oz, box_length_in, box_width_in, box_height_in, package_type, inventory_id")
          .eq("id", order.auction_id).single();
        if (auction) {
          weightOz = auction.shipping_weight_oz ?? 16;
          lengthIn = auction.box_length_in ?? null;
          widthIn = auction.box_width_in ?? null;
          heightIn = auction.box_height_in ?? null;
          packageType = auction.package_type ?? null;
        }
      } else if (order.listing_id) {
        const { data: listing } = await admin.from("listings")
          .select("shipping_weight_oz, box_length_in, box_width_in, box_height_in, package_type, inventory_id")
          .eq("id", order.listing_id).single();
        if (listing) {
          weightOz = listing.shipping_weight_oz ?? 16;
          lengthIn = listing.box_length_in ?? null;
          widthIn = listing.box_width_in ?? null;
          heightIn = listing.box_height_in ?? null;
          packageType = listing.package_type ?? null;
        }
      }

      // Fetch seller ship-from address
      const { data: seller } = await admin.from("profiles")
        .select("ship_from_address, shipping_services")
        .eq("id", user.id).single();

      if (!seller?.ship_from_address) {
        return NextResponse.json({ error: "Seller ship-from address not configured" }, { status: 400 });
      }

      const from = seller.ship_from_address as {
        name: string; street1: string; city: string; state: string; zip: string; country: string; phone?: string;
      };
      const to = {
        name: shippingAddr.name ?? "",
        street1: shippingAddr.line1 ?? shippingAddr.street1 ?? "",
        street2: shippingAddr.line2 ?? null,
        city: shippingAddr.city ?? "",
        state: shippingAddr.state ?? "",
        zip: shippingAddr.zip ?? "",
        country: shippingAddr.country ?? "US",
      };

      const enabledServices = (seller.shipping_services as string[] | null) ?? undefined;
      const freshRates = await getShippingRates({ from, to, weightOz, enabledServices, packageType, lengthIn, widthIn, heightIn });

      if (!freshRates.length) {
        return NextResponse.json({ error: "No shipping rates available — check seller ship-from address" }, { status: 400 });
      }

      // Prefer the same service if still available, otherwise use cheapest
      const targetService = order.shipping_service as string | null;
      const matched = freshRates.find((r) => r.servicelevelToken === targetService) ?? freshRates[0];

      const result = await tryPurchase(matched.objectId);
      // Update stored rate ID so future attempts use the fresh one
      await admin.from("orders").update({ shippo_rate_id: matched.objectId }).eq("id", orderId);
      return NextResponse.json({ labelUrl: result.labelUrl, trackingNumber: result.trackingNumber });
    } catch (fallbackErr) {
      const msg = fallbackErr instanceof Error ? fallbackErr.message : "Label purchase failed";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
}
