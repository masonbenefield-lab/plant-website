import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MessageSquare } from "lucide-react";

export default async function MessagesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: conversations } = await supabase
    .from("conversations")
    .select("id, participant_a, participant_b, last_message_at, last_message_preview")
    .or(`participant_a.eq.${user.id},participant_b.eq.${user.id}`)
    .order("last_message_at", { ascending: false, nullsFirst: false });

  // Gather other participant IDs and fetch their profiles
  const otherIds = (conversations ?? []).map((c) =>
    c.participant_a === user.id ? c.participant_b : c.participant_a
  );

  const { data: profiles } = otherIds.length
    ? await supabase.from("profiles").select("id, username, avatar_url").in("id", otherIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  // Count unread per conversation
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
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold">Messages</h1>

      {!conversations?.length ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <MessageSquare className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">No conversations yet</p>
            <p className="text-muted-foreground text-sm">
              Visit a seller&apos;s storefront to start a conversation.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map((conv) => {
            const otherId = conv.participant_a === user.id ? conv.participant_b : conv.participant_a;
            const other = profileMap[otherId];
            const unread = unreadMap[conv.id] ?? 0;

            return (
              <Link key={conv.id} href={`/messages/${conv.id}`}>
                <Card className={cn("hover:bg-muted/40 transition-colors", unread > 0 && "border-green-300 bg-green-50/50 dark:bg-green-950/20")}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-full bg-muted overflow-hidden">
                        {other?.avatar_url ? (
                          <Image src={other.avatar_url} alt={other.username ?? ""} width={40} height={40} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                            {other?.username?.slice(0, 2).toUpperCase() ?? "?"}
                          </div>
                        )}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm font-medium", unread > 0 && "font-semibold")}>
                          {other?.username ?? "Unknown user"}
                        </span>
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatTime(conv.last_message_at)}
                          </span>
                        )}
                      </div>
                      {conv.last_message_preview && (
                        <p className={cn("text-sm truncate mt-0.5", unread > 0 ? "text-foreground" : "text-muted-foreground")}>
                          {conv.last_message_preview}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "short" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
