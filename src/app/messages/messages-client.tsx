"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare, Search, X, SquarePen, Loader2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

type Conversation = {
  id: string;
  participant_a: string;
  participant_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
};

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type SearchUser = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

type Props = {
  conversations: Conversation[];
  profileMap: Record<string, Profile>;
  unreadMap: Record<string, number>;
  currentUserId: string;
};

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

export function MessagesClient({ conversations, profileMap, unreadMap, currentUserId }: Props) {
  const router = useRouter();

  const [localConversations, setLocalConversations] = useState(conversations);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const [newMsgQuery, setNewMsgQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = q.trim()
    ? localConversations.filter((c) => {
        const otherId = c.participant_a === currentUserId ? c.participant_b : c.participant_a;
        return profileMap[otherId]?.username.toLowerCase().includes(q.toLowerCase());
      })
    : localConversations;

  async function deleteConversation(convId: string) {
    setDeletingId(convId);
    setConfirmDeleteId(null);
    try {
      const res = await fetch("/api/messages/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convId }),
      });
      if (!res.ok) { toast.error("Failed to delete conversation"); return; }
      setLocalConversations((prev) => prev.filter((c) => c.id !== convId));
    } finally {
      setDeletingId(null);
    }
  }

  function handleQueryChange(val: string) {
    setNewMsgQuery(val);
    setSuggestions([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!val.trim() || val.trim().length < 2) { setSearching(false); return; }
    setSearching(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setSuggestions((data.users ?? []).slice(0, 6));
      } finally {
        setSearching(false);
      }
    }, 350);
  }

  function openNewMsg() {
    setNewMsgQuery("");
    setSuggestions([]);
    setNewMsgOpen(true);
  }

  function closeNewMsg() {
    setNewMsgOpen(false);
    setNewMsgQuery("");
    setSuggestions([]);
  }

  async function startConversation(recipientId: string) {
    setStarting(true);
    try {
      const res = await fetch("/api/messages/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Could not start conversation"); return; }
      closeNewMsg();
      router.push(`/messages/${data.conversationId}`);
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Messages</h1>
        <Button onClick={openNewMsg} size="sm" className="bg-leaf hover:bg-forest gap-1.5">
          <SquarePen size={14} />
          New Message
        </Button>
      </div>

      {/* Search existing conversations */}
      {localConversations.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations…"
            className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Conversation list */}
      {!localConversations.length ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <MessageSquare className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">No conversations yet</p>
            <p className="text-muted-foreground text-sm">
              Use &ldquo;New Message&rdquo; above to start a conversation.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No conversations match &ldquo;{q}&rdquo;</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((conv) => {
            const otherId = conv.participant_a === currentUserId ? conv.participant_b : conv.participant_a;
            const other = profileMap[otherId];
            const unread = unreadMap[conv.id] ?? 0;
            const isConfirming = confirmDeleteId === conv.id;
            const isDeleting = deletingId === conv.id;

            return (
              <div key={conv.id} className="relative group">
                <Link href={`/messages/${conv.id}`}>
                  <Card className={cn("hover:bg-muted/40 transition-colors pr-10", unread > 0 && "border-[#A8BF9A] bg-[#EBF0E6]/50 dark:bg-forest/20")}>
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
                          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-leaf text-white text-[10px] font-bold flex items-center justify-center">
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

                {/* Delete button — appears on hover */}
                {!isConfirming && (
                  <button
                    onClick={(e) => { e.preventDefault(); setConfirmDeleteId(conv.id); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 z-10"
                    aria-label="Delete conversation"
                  >
                    {isDeleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  </button>
                )}

                {/* Inline confirm */}
                {isConfirming && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/95 rounded-lg border border-destructive/30 z-10 px-4">
                    <span className="text-sm font-medium text-foreground mr-1">Delete this conversation?</span>
                    <button
                      onClick={() => deleteConversation(conv.id)}
                      className="px-3 py-1 text-xs font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-3 py-1 text-xs font-medium rounded-md border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* New Message dialog */}
      <Dialog open={newMsgOpen} onOpenChange={(open) => { if (!open) closeNewMsg(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                value={newMsgQuery}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search by username or name…"
                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
              />
              {newMsgQuery && (
                <button onClick={() => { setNewMsgQuery(""); setSuggestions([]); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={14} />
                </button>
              )}
            </div>

            {searching && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 px-1">
                <Loader2 size={12} className="animate-spin" /> Searching…
              </p>
            )}

            {suggestions.length > 0 && (
              <div className="rounded-lg border overflow-hidden divide-y">
                {suggestions.map((u) => (
                  <button
                    key={u.id}
                    disabled={starting}
                    onClick={() => startConversation(u.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors disabled:opacity-60"
                  >
                    {u.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatar_url} alt={u.username} className="w-9 h-9 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-[#DFE7D4] flex items-center justify-center text-leaf text-sm font-bold shrink-0">
                        {u.username.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-tight">{u.display_name || u.username}</p>
                      {u.display_name && <p className="text-xs text-muted-foreground">@{u.username}</p>}
                    </div>
                    {starting && <Loader2 size={14} className="animate-spin shrink-0" />}
                  </button>
                ))}
              </div>
            )}

            {!searching && newMsgQuery.trim().length >= 2 && suggestions.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No users found</p>
            )}

            {!newMsgQuery.trim() && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Type a name or username to find someone
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
