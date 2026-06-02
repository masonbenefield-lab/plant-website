import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import { sendRefundIssuedToBuyer, sendRefundIssuedToSeller } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Fetch dispute — seller only
  const { data: dispute } = await supabase
    .from("order_disputes")
    .select("id, order_id, buyer_id, seller_id, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status === "resolved") return NextResponse.json({ error: "Already resolved" }, { status: 400 });
  if (dispute.status === "escalated") return NextResponse.json({ error: "Escalated disputes cannot be refunded here" }, { status: 400 });

  // Fetch the order to get the Stripe payment intent
  const { data: order } = await supabase
    .from("orders")
    .select("id, amount_cents, stripe_payment_intent_id, status")
    .eq("id", dispute.order_id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (!order.stripe_payment_intent_id) return NextResponse.json({ error: "No payment on record for this order" }, { status: 400 });
  if (order.status === "refunded") return NextResponse.json({ error: "Order already refunded" }, { status: 400 });

  // Issue refund via Stripe
  try {
    await getStripe().refunds.create({
      payment_intent: order.stripe_payment_intent_id,
      reverse_transfer: true,
      refund_application_fee: true,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Stripe refund failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Update order and dispute
  await Promise.all([
    supabase.from("orders").update({ status: "refunded" }).eq("id", order.id),
    supabase.from("order_disputes").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
    }).eq("id", id),
  ]);

  // Email both parties
  try {
    const admin = adminClient();
    const [{ data: sellerProfile }, { data: buyerAuthData }] = await Promise.all([
      supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
      admin.auth.admin.getUserById(dispute.buyer_id),
    ]);
    const buyerEmail = buyerAuthData?.user?.email;
    const sellerEmail = (await admin.auth.admin.getUserById(user.id)).data?.user?.email;
    const sellerDisplayName = (sellerProfile as { display_name?: string | null; username?: string | null } | null)?.display_name ?? sellerProfile?.username ?? "The seller";

    await Promise.all([
      buyerEmail
        ? sendRefundIssuedToBuyer({
            buyerEmail,
            sellerUsername: sellerDisplayName,
            amountCents: order.amount_cents,
          }).catch(() => {})
        : Promise.resolve(),
      sellerEmail
        ? sendRefundIssuedToSeller({
            sellerEmail,
            amountCents: order.amount_cents,
          }).catch(() => {})
        : Promise.resolve(),
    ]);
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true });
}
