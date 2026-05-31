import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { purchaseLabel } from "@/lib/shippo";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

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

  const { orderId, rateId, rateAmountCents } = await request.json() as { orderId: string; rateId?: string; rateAmountCents?: number };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  // Confirm caller owns this order as seller
  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, shippo_rate_id, shippo_transaction_id, label_url, stripe_payment_intent_id")
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

  try {
    const { transactionId, trackingNumber, labelUrl } = await purchaseLabel(effectiveRateId);

    const admin = adminClient();
    await admin.from("orders").update({
      shippo_transaction_id: transactionId,
      tracking_number: trackingNumber,
      label_url: labelUrl,
      status: "shipped",
    }).eq("id", orderId);

    // Recover postage cost from seller's Stripe transfer (best-effort, never blocks label delivery)
    if (rateAmountCents && order.stripe_payment_intent_id) {
      try {
        const stripe = getStripe();
        const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id, {
          expand: ["latest_charge.transfer"],
        });
        const charge = pi.latest_charge as Stripe.Charge | null;
        const transfer = charge?.transfer as Stripe.Transfer | null;
        if (transfer?.id) {
          await stripe.transfers.createReversal(transfer.id, {
            amount: rateAmountCents,
            description: `Postage for order ${orderId}`,
          });
        }
      } catch (stripeErr) {
        console.error("Postage reversal failed:", stripeErr);
      }
    }

    return NextResponse.json({ labelUrl, trackingNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Label purchase failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
