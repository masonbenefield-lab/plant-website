import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { MessageThread } from "./message-thread";
import { ChevronLeft } from "lucide-react";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b")
    .eq("id", id)
    .single();

  if (!conversation) notFound();
  if (conversation.participant_a !== user.id && conversation.participant_b !== user.id) notFound();

  const otherId =
    conversation.participant_a === user.id
      ? conversation.participant_b
      : conversation.participant_a;

  const [{ data: otherProfile }, { data: messages }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").eq("id", otherId).single(),
    supabase
      .from("messages")
      .select("id, sender_id, body, read_at, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true }),
  ]);

  const otherUser = {
    id: otherId,
    username: otherProfile?.username ?? null,
    avatar_url: otherProfile?.avatar_url ?? null,
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col" style={{ height: "calc(100vh - 4rem)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-background shrink-0">
        <Link href="/messages" className="text-muted-foreground hover:text-foreground">
          <ChevronLeft size={20} />
        </Link>
        <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
          {otherUser.avatar_url ? (
            <Image
              src={otherUser.avatar_url}
              alt={otherUser.username ?? ""}
              width={36}
              height={36}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
              {otherUser.username?.slice(0, 2).toUpperCase() ?? "?"}
            </div>
          )}
        </div>
        <div>
          <Link
            href={otherUser.username ? `/sellers/${otherUser.username}` : "#"}
            className="font-semibold text-sm hover:underline"
          >
            {otherUser.username ?? "Unknown user"}
          </Link>
        </div>
      </div>

      {/* Thread */}
      <div className="flex-1 overflow-hidden">
        <MessageThread
          conversationId={id}
          currentUserId={user.id}
          otherUser={otherUser}
          initialMessages={messages ?? []}
        />
      </div>
    </div>
  );
}
