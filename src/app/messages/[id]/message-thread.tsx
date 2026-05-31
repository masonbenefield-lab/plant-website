"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { findProhibitedWord, censorWord } from "@/lib/profanity";
import { cn } from "@/lib/utils";
import { Send, Loader2, Trash2 } from "lucide-react";

interface Message {
  id: string;
  sender_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
}

interface MessageThreadProps {
  conversationId: string;
  currentUserId: string;
  otherUser: { id: string; username: string | null; avatar_url: string | null };
  initialMessages: Message[];
}

export function MessageThread({
  conversationId,
  currentUserId,
  otherUser,
  initialMessages,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Mark messages as read on mount
  useEffect(() => {
    fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
  }, [conversationId]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          // Avoid duplicates from optimistic updates
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          // Mark as read immediately if it's from the other person
          if (newMsg.sender_id !== currentUserId) {
            fetch("/api/messages/read", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ conversationId }),
            });
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, currentUserId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;

    // Client-side filter check
    const badWord = findProhibitedWord(trimmed);
    if (badWord) {
      toast.error(`Your message contains a prohibited word: "${censorWord(badWord)}"`);
      return;
    }

    startTransition(async () => {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, body: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Failed to send message");
        return;
      }

      const { message } = await res.json();
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      setBody("");
      textareaRef.current?.focus();
    });
  }

  async function handleDeleteMessage(messageId: string) {
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    const res = await fetch("/api/messages/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId }),
    });
    if (!res.ok) {
      // Restore on failure
      setMessages(initialMessages);
      toast.error("Failed to delete message");
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // Group messages by date
  const grouped = groupByDate(messages);

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            No messages yet. Say hello!
          </p>
        )}
        {grouped.map(({ date, msgs }) => (
          <div key={date} className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">{date}</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            {msgs.map((msg) => {
              const isMe = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={cn("flex items-end gap-2 group", isMe ? "justify-end" : "justify-start")}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0">
                      {otherUser.avatar_url ? (
                        <Image src={otherUser.avatar_url} alt={otherUser.username ?? ""} width={28} height={28} className="object-cover w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                          {otherUser.username?.slice(0, 1).toUpperCase() ?? "?"}
                        </div>
                      )}
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-4 py-2 text-sm leading-relaxed",
                      isMe
                        ? "bg-leaf text-white rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                    <p className={cn("text-[10px] mt-0.5 text-right", isMe ? "text-[#C5D4BC]" : "text-muted-foreground")}>
                      {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {isMe && (
                    <button
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-destructive transition-all shrink-0"
                      aria-label="Delete message"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t px-4 py-3 flex gap-2 items-end bg-background">
        <Textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
          rows={1}
          className="resize-none min-h-[40px] max-h-32 overflow-y-auto"
        />
        <Button
          onClick={handleSend}
          disabled={isPending || !body.trim()}
          size="sm"
          className="bg-leaf hover:bg-forest shrink-0 h-10"
        >
          {isPending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </Button>
      </div>
    </div>
  );
}

function groupByDate(messages: Message[]) {
  const groups: { date: string; msgs: Message[] }[] = [];
  let currentDate = "";
  for (const msg of messages) {
    const date = formatDate(msg.created_at);
    if (date !== currentDate) {
      currentDate = date;
      groups.push({ date, msgs: [] });
    }
    groups[groups.length - 1].msgs.push(msg);
  }
  return groups;
}

function formatDate(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en-US", { weekday: "long" });
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}
