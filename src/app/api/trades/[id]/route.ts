import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendTradeAccepted, sendTradeDeclined } from "@/lib/email";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { action } = await request.json() as { action: "accept" | "decline" | "cancel" };

  if (!["accept", "decline", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const admin = adminClient();

  const { data: trade } = await admin
    .from("trade_offers")
    .select("id, proposer_id, recipient_id, offer_description, want_description, status")
    .eq("id", id)
    .single();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  if (trade.proposer_id !== user.id && trade.recipient_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  if (trade.status !== "pending") {
    return NextResponse.json({ error: "Trade is no longer pending" }, { status: 409 });
  }

  if ((action === "accept" || action === "decline") && trade.recipient_id !== user.id) {
    return NextResponse.json({ error: "Only the recipient can accept or decline" }, { status: 403 });
  }

  if (action === "cancel" && trade.proposer_id !== user.id) {
    return NextResponse.json({ error: "Only the proposer can cancel" }, { status: 403 });
  }

  const newStatus = action === "accept" ? "accepted" : action === "decline" ? "declined" : "cancelled";

  const { error } = await admin
    .from("trade_offers")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (action === "accept" || action === "decline") {
    const { data: proposerAuth } = await admin.auth.admin
      .getUserById(trade.proposer_id)
      .catch(() => ({ data: null }));
    const proposerEmail = (proposerAuth as { user?: { email?: string } } | null)?.user?.email;

    const [{ data: proposerProfile }, { data: recipientProfile }] = await Promise.all([
      admin.from("profiles").select("username").eq("id", trade.proposer_id).single(),
      admin.from("profiles").select("username").eq("id", trade.recipient_id).single(),
    ]);

    if (proposerEmail) {
      if (action === "accept") {
        sendTradeAccepted({
          toEmail: proposerEmail,
          proposerUsername: proposerProfile?.username ?? "you",
          recipientUsername: recipientProfile?.username ?? "them",
          offerDescription: trade.offer_description,
          tradeId: trade.id,
        }).catch(() => {});
      } else {
        sendTradeDeclined({
          toEmail: proposerEmail,
          proposerUsername: proposerProfile?.username ?? "you",
          recipientUsername: recipientProfile?.username ?? "them",
          offerDescription: trade.offer_description,
          tradeId: trade.id,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ success: true });
}
