import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId } = await request.json() as { orderId: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const { data: order } = await supabase
    .from("orders")
    .select("stripe_payment_intent_id, buyer_id, status")
    .eq("id", orderId)
    .single();

  if (!order || order.buyer_id !== user.id || order.status !== "pending") {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  try {
    await getStripe().paymentIntents.cancel(order.stripe_payment_intent_id);
  } catch {
    // PI may already be canceled; that's fine
  }

  return NextResponse.json({ ok: true });
}
