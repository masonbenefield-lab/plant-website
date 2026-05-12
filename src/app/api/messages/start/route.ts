import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

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

  const { recipientId } = await req.json();
  if (!recipientId || recipientId === user.id) {
    return NextResponse.json({ error: "Invalid recipient" }, { status: 400 });
  }

  // Verify recipient exists
  const { data: recipient } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", recipientId)
    .single();
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });

  // Check blocks in either direction
  const { data: blockCheck } = await supabase
    .from("blocks")
    .select("id")
    .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${recipientId}),and(blocker_id.eq.${recipientId},blocked_id.eq.${user.id})`)
    .maybeSingle();
  if (blockCheck) return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });

  // Normalize participant order so UNIQUE constraint works
  const [a, b] = [user.id, recipientId].sort();

  const admin = adminClient();

  // Find existing conversation
  const { data: existing } = await admin
    .from("conversations")
    .select("id")
    .eq("participant_a", a)
    .eq("participant_b", b)
    .maybeSingle();

  if (existing) return NextResponse.json({ conversationId: existing.id });

  // Create new conversation
  const { data: created, error } = await admin
    .from("conversations")
    .insert({ participant_a: a, participant_b: b })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  return NextResponse.json({ conversationId: created.id });
}
