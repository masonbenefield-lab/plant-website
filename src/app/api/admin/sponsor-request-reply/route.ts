import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { requestId, recipientId, body } = await req.json();
  if (!recipientId || !body?.trim()) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find or create conversation between admin and requester
  const [a, b] = [user.id, recipientId].sort();

  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  let conversationId: string;

  if (existing) {
    conversationId = existing.id;
  } else {
    const { data: created, error } = await admin
      .from("conversations")
      .insert({ participant_a: a, participant_b: b })
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
    conversationId = created.id;
  }

  // Send message as admin user
  const { data: message, error: msgError } = await admin
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, body: body.trim() })
    .select("id, created_at")
    .single();

  if (msgError) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

  // Update conversation preview
  await admin.from("conversations").update({
    last_message_at: message.created_at,
    last_message_preview: body.trim().slice(0, 100),
  }).eq("id", conversationId);

  // Mark request as closed
  if (requestId) {
    await admin.from("giveaway_sponsor_requests").update({ status: "closed" }).eq("id", requestId);
  }

  return NextResponse.json({ ok: true, conversationId });
}
