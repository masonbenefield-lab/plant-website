import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: tradeId } = await params;
  const { body } = await request.json() as { body: string };

  if (!body?.trim()) {
    return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });
  }

  if (body.trim().length > 2000) {
    return NextResponse.json({ error: "Message too long" }, { status: 400 });
  }

  const { data: trade } = await supabase
    .from("trade_offers")
    .select("id, proposer_id, recipient_id")
    .eq("id", tradeId)
    .single();

  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });

  if (trade.proposer_id !== user.id && trade.recipient_id !== user.id) {
    return NextResponse.json({ error: "Not a participant" }, { status: 403 });
  }

  const { data: message, error } = await supabase
    .from("trade_messages")
    .insert({
      trade_id: tradeId,
      sender_id: user.id,
      body: body.trim(),
    })
    .select("id, trade_id, sender_id, body, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ message });
}
