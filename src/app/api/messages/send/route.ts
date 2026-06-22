import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { containsSlur, findProhibitedWord, censorWord } from "@/lib/profanity";
import { isBlocked } from "@/lib/blocks";
import { sendPushToUser } from "@/lib/push";

function adminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { conversationId, body } = await req.json();
  if (!conversationId || !body?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (body.trim().length > 2000) {
    return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
  }

  // Word filter check
  if (containsSlur(body)) {
    const word = findProhibitedWord(body);
    // Log violation (fire-and-forget)
    supabase.from("word_violations").insert({
      user_id: user.id,
      word: word ?? "unknown",
      context: "message",
      content_snippet: body.slice(0, 120),
    }).then(() => {});
    return NextResponse.json(
      { error: `Your message contains a prohibited word${word ? `: "${censorWord(word)}"` : ""}` },
      { status: 400 }
    );
  }

  // Verify user is a participant in this conversation
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", conversationId)
    .single();

  if (!conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  if (conversation.participant_a !== user.id && conversation.participant_b !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const otherId = conversation.participant_a === user.id ? conversation.participant_b : conversation.participant_a;
  if (await isBlocked(user.id, otherId)) {
    return NextResponse.json({ error: "Unable to send message." }, { status: 403 });
  }

  const trimmedBody = body.trim();

  // Insert message
  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      body: trimmedBody,
    })
    .select("id, sender_id, body, read_at, created_at")
    .single();

  if (error) return NextResponse.json({ error: "Failed to send message" }, { status: 500 });

  // Update conversation preview (admin client to bypass RLS on update)
  const admin = adminClient();
  await admin
    .from("conversations")
    .update({
      last_message_at: message.created_at,
      last_message_preview: trimmedBody.slice(0, 100),
    })
    .eq("id", conversationId);

  // Fetch sender username for the push title
  const { data: senderProfile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  // Await so the push actually sends before the serverless function exits
  // (fire-and-forget gets killed when the response returns on Vercel).
  await sendPushToUser(
    otherId,
    senderProfile?.username ? `New message from ${senderProfile.username}` : 'New message',
    trimmedBody.length > 100 ? trimmedBody.slice(0, 97) + '…' : trimmedBody,
    { url: `/messages/${conversationId}` }
  );

  return NextResponse.json({ message });
}
