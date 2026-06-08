import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { isBlocked } from "@/lib/blocks";
import { sendTradeProposed } from "@/lib/email";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!checkRateLimit(`trade:${user.id}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { recipientId, offerDescription, wantDescription } = await request.json() as {
    recipientId: string;
    offerDescription: string;
    wantDescription: string;
  };

  if (!recipientId || !offerDescription?.trim() || !wantDescription?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (recipientId === user.id) {
    return NextResponse.json({ error: "You cannot trade with yourself" }, { status: 400 });
  }

  if (offerDescription.trim().length > 500 || wantDescription.trim().length > 500) {
    return NextResponse.json({ error: "Descriptions must be 500 characters or less" }, { status: 400 });
  }

  const { data: recipient } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", recipientId)
    .single();

  if (!recipient) {
    return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  }

  if (await isBlocked(user.id, recipientId)) {
    return NextResponse.json({ error: "Unable to send trade proposal" }, { status: 403 });
  }

  const { data: existing } = await supabase
    .from("trade_offers")
    .select("id")
    .eq("proposer_id", user.id)
    .eq("recipient_id", recipientId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "You already have a pending trade with this person" }, { status: 409 });
  }

  const { data: trade, error } = await supabase
    .from("trade_offers")
    .insert({
      proposer_id: user.id,
      recipient_id: recipientId,
      offer_description: offerDescription.trim(),
      want_description: wantDescription.trim(),
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const admin = adminClient();
  const { data: proposerProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  const { data: recipientAuth } = await admin.auth.admin
    .getUserById(recipientId)
    .catch(() => ({ data: null }));
  const recipientEmail = (recipientAuth as { user?: { email?: string } } | null)?.user?.email;

  if (recipientEmail) {
    sendTradeProposed({
      toEmail: recipientEmail,
      recipientUsername: recipient.username,
      proposerUsername: proposerProfile?.username ?? "Someone",
      offerDescription: offerDescription.trim(),
      wantDescription: wantDescription.trim(),
      tradeId: trade.id,
    }).catch(() => {});
  }

  return NextResponse.json({ tradeId: trade.id });
}
