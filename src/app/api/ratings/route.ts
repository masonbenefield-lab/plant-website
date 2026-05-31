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

  const { orderId, score, comment, photos } = await request.json() as {
    orderId: string;
    score: number;
    comment?: string;
    photos?: string[];
  };

  if (!orderId || !score || !Number.isInteger(score) || score < 1 || score > 5) {
    return NextResponse.json({ error: "Score must be a whole number between 1 and 5" }, { status: 400 });
  }

  if (comment && comment.length > 1000) {
    return NextResponse.json({ error: "Comment must be 1000 characters or fewer" }, { status: 400 });
  }

  if (photos && photos.length > 5) {
    return NextResponse.json({ error: "Maximum 5 photos per review" }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("seller_id, buyer_id, status, delivered_at")
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

  if (order.delivered_at) {
    const deadline = new Date(order.delivered_at);
    deadline.setDate(deadline.getDate() + 14);
    if (new Date() > deadline) {
      return NextResponse.json(
        { error: "The 14-day review window for this order has closed" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabase.from("ratings").insert({
    reviewer_id: user.id,
    seller_id: order.seller_id,
    order_id: orderId,
    score,
    comment: comment || null,
    photos: photos?.length ? photos : null,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Already rated this order" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
