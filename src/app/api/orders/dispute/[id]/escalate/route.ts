import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDisputeEscalatedToAdmin } from "@/lib/email";

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

  const { data: dispute } = await supabase
    .from("order_disputes")
    .select("id, buyer_id, seller_id, reason, details, seller_response, status, order_id, created_at")
    .eq("id", id)
    .eq("buyer_id", user.id)
    .single();

  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status === "resolved") return NextResponse.json({ error: "Dispute is already resolved" }, { status: 400 });
  if (dispute.status === "escalated") return NextResponse.json({ error: "Already escalated" }, { status: 400 });

  // Must be at least 5 days old OR seller hasn't responded — buyer can always escalate after seller responds
  const createdAt = new Date(dispute.created_at);
  const daysSinceFiled = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const sellerHasResponded = dispute.status === "seller_responded";
  if (!sellerHasResponded && daysSinceFiled < 5) {
    const daysLeft = Math.ceil(5 - daysSinceFiled);
    return NextResponse.json({
      error: `You can escalate in ${daysLeft} day${daysLeft === 1 ? "" : "s"} if the seller hasn't responded.`,
    }, { status: 400 });
  }

  const { error } = await supabase
    .from("order_disputes")
    .update({ status: "escalated", escalated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify admin
  try {
    const admin = adminClient();
    const [{ data: buyerProfile }, { data: sellerProfile }] = await Promise.all([
      supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
      supabase.from("profiles").select("username, display_name").eq("id", dispute.seller_id).single(),
    ]);
    const buyerDisplayName = (buyerProfile as { display_name?: string | null; username?: string | null } | null)?.display_name ?? buyerProfile?.username ?? "Unknown buyer";
    const sellerDisplayName = (sellerProfile as { display_name?: string | null; username?: string | null } | null)?.display_name ?? sellerProfile?.username ?? "Unknown seller";
    await sendDisputeEscalatedToAdmin({
      adminEmail: "masonbenefield@gmail.com",
      buyerUsername: buyerDisplayName,
      sellerUsername: sellerDisplayName,
      reason: dispute.reason,
      details: dispute.details,
      sellerResponse: dispute.seller_response,
      orderId: dispute.order_id,
      disputeId: id,
    }).catch(() => {});
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true });
}
