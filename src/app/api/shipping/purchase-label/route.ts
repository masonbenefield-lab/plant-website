import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { purchaseLabel } from "@/lib/shippo";

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

  // Confirm caller owns this order as seller
  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, shippo_rate_id, shippo_transaction_id, label_url")
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

    return NextResponse.json({ labelUrl, trackingNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Label purchase failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
