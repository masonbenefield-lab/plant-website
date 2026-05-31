import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

function admin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, messageId } = await req.json();
  const db = admin();

  if (conversationId) {
    const { data: conv } = await db
      .from("conversations")
      .select("participant_a, participant_b")
      .eq("id", conversationId)
      .single();

    if (!conv || (conv.participant_a !== user.id && conv.participant_b !== user.id)) {
      return NextResponse.json({ error: "Not a participant" }, { status: 403 });
    }

    await db.from("messages").delete().eq("conversation_id", conversationId);
    await db.from("conversations").delete().eq("id", conversationId);
    return NextResponse.json({ ok: true });
  }

  if (messageId) {
    const { data: msg } = await db
      .from("messages")
      .select("sender_id")
      .eq("id", messageId)
      .single();

    if (!msg || msg.sender_id !== user.id) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    await db.from("messages").delete().eq("id", messageId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Missing conversationId or messageId" }, { status: 400 });
}
