import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MessagesClient } from "./messages-client";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b, last_message_at, last_message_preview")
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  const otherIds = (conversations ?? []).map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );

  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", otherIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  const { data: unreadRows } = await supabase
    .from("messages")
    .select("conversation_id")
    .is("read_at", null)
    .neq("sender_id", user.id)
    .in("conversation_id", (conversations ?? []).map((c) => c.id));

  const unreadMap: Record<string, number> = {};
  for (const row of unreadRows ?? []) {
    unreadMap[row.conversation_id] = (unreadMap[row.conversation_id] ?? 0) + 1;
  }

  return (
    <MessagesClient
      conversations={conversations ?? []}
      profileMap={profileMap as Record<string, { id: string; username: string; display_name: string | null; avatar_url: string | null }>}
      unreadMap={unreadMap}
      currentUserId={user.id}
    />
  );
}
