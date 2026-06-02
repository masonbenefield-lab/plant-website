import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  sendDisputeToSeller,
  sendDisputeConfirmationToBuyer,
} from "@/lib/email";

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

  const { orderId, reason, details } = await request.json() as {
    orderId: string;
    reason: string;
    details?: string;
  };

  if (!orderId || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, status")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Check no open dispute already exists
  const { data: existing } = await supabase
    .from("order_disputes")
    .select("id")
    .eq("order_id", orderId)
    .neq("status", "resolved")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "A dispute is already open for this order." }, { status: 409 });
  }

  const { data: dispute, error: insertErr } = await supabase
    .from("order_disputes")
    .insert({
      order_id: orderId,
      buyer_id: user.id,
      seller_id: order.seller_id,
      reason,
      details: details?.trim() || null,
    })
    .select("id")
    .single();

  if (insertErr || !dispute) {
    return NextResponse.json({ error: insertErr?.message ?? "Failed to file dispute" }, { status: 500 });
  }

  // Fetch names and emails for notifications
  const admin = adminClient();
  const [
    { data: buyerProfile },
    { data: sellerProfile },
    { data: sellerAuthData },
    { data: buyerAuthData },
  ] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", user.id).single(),
    supabase.from("profiles").select("username").eq("id", order.seller_id).single(),
    admin.auth.admin.getUserById(order.seller_id),
    admin.auth.admin.getUserById(user.id),
  ]);

  const sellerEmail = sellerAuthData?.user?.email;
  const buyerEmail = buyerAuthData?.user?.email;
  const buyerUsername = buyerProfile?.username ?? "A buyer";
  const sellerUsername = sellerProfile?.username ?? "the seller";

  await Promise.allSettled([
    sellerEmail
      ? sendDisputeToSeller({ sellerEmail, buyerUsername, reason, details, orderId, disputeId: dispute.id })
      : Promise.resolve(),
    buyerEmail
      ? sendDisputeConfirmationToBuyer({ buyerEmail, sellerUsername, reason })
      : Promise.resolve(),
  ]);

  return NextResponse.json({ ok: true, disputeId: dispute.id });
}
