import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`ratings:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests — please wait a moment" }, { status: 429 });
  }

  const { orderId, score, comment } = await request.json() as {
    orderId: string;
    score: number;
    comment?: string;
  };

  if (!orderId || !score || score < 1 || score > 5) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("seller_id, buyer_id, status")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .eq("status", "delivered")
    .single();

  if (orderError || !order) {
    return NextResponse.json(
      { error: "Order not found or not yet delivered" },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("ratings").insert({
    reviewer_id: user.id,
    seller_id: order.seller_id,
    order_id: orderId,
    score,
    comment: comment || null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already rated this order" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
