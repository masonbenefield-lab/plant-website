import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDisputeResponseToBuyer } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message } = await request.json() as { message: string };
  if (!message?.trim()) return NextResponse.json({ error: "Message is required" }, { status: 400 });

  const { data: dispute } = await supabase
    .from("order_disputes")
    .select("id, buyer_id, seller_id, status, last_replied_by_role")
    .eq("id", id)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .single();

  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status === "resolved" || dispute.status === "escalated") {
    return NextResponse.json({ error: "This dispute is closed" }, { status: 400 });
  }

  const isSeller = dispute.seller_id === user.id;
  const role = isSeller ? "seller" : "buyer";

  const { data: newMsg, error: msgErr } = await supabase
    .from("order_dispute_messages")
    .insert({ dispute_id: id, sender_id: user.id, message: message.trim() })
    .select("id, sender_id, message, images, created_at")
    .single();

  if (msgErr || !newMsg) return NextResponse.json({ error: msgErr?.message ?? "Failed to send" }, { status: 500 });

  // Update dispute status and reply tracking
  await supabase.from("order_disputes").update({
    last_replied_at: new Date().toISOString(),
    last_replied_by_role: role,
    ...(isSeller && dispute.status === "seller_notified"
      ? { status: "seller_responded", responded_at: new Date().toISOString() }
      : {}),
  }).eq("id", id);

  // Notify the other party if seller is replying for the first time
  if (isSeller && dispute.status === "seller_notified") {
    try {
      const admin = adminClient();
      const [{ data: sellerProfile }, { data: buyerAuthData }] = await Promise.all([
        supabase.from("profiles").select("username, display_name").eq("id", user.id).single(),
        admin.auth.admin.getUserById(dispute.buyer_id),
      ]);
      const buyerEmail = buyerAuthData?.user?.email;
      const sellerDisplayName = (sellerProfile as { display_name?: string | null; username?: string | null } | null)?.display_name ?? sellerProfile?.username ?? "The seller";
      if (buyerEmail) {
        await sendDisputeResponseToBuyer({
          buyerEmail,
          sellerUsername: sellerDisplayName,
          sellerResponse: message.trim(),
          disputeId: id,
        }).catch(() => {});
      }
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ ok: true, message: newMsg });
}
