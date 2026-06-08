"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  trade_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

interface TradeChatProps {
  tradeId: string;
  currentUserId: string;
  currentUsername: string;
  currentAvatarUrl: string | null;
  otherUsername: string;
  otherAvatarUrl: string | null;
  initialMessages: Message[];
  tradeClosed: boolean;
}

export function TradeChat({
  tradeId,
  currentUserId,
  currentUsername,
  currentAvatarUrl,
  otherUsername,
  otherAvatarUrl,
  initialMessages,
  tradeClosed,
}: TradeChatProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`trade-messages:${tradeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trade_messages",
          filter: `trade_id=eq.${tradeId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tradeId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || sending) return;

    const text = body.trim();
    setBody("");
    setSending(true);

    const optimistic: Message = {
      id: `opt-${Date.now()}`,
      trade_id: tradeId,
      sender_id: currentUserId,
      body: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await fetch(`/api/trades/${tradeId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });

    if (!res.ok) {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setBody(text);
    } else {
      const { message } = await res.json();
      setMessages((prev) =>
        prev.map((m) => (m.id === optimistic.id ? message : m))
      );
    }

    setSending(false);
  }

  function avatarFor(senderId: string) {
    const isMe = senderId === currentUserId;
    return {
      url: isMe ? currentAvatarUrl : otherAvatarUrl,
      username: isMe ? currentUsername : otherUsername,
    };
  }

  return (
    <div className="flex flex-col rounded-xl border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <p className="text-sm font-semibold">Trade Chat</p>
        <p className="text-xs text-muted-foreground">
          Coordinate details with {otherUsername}
        </p>
      </div>

      {/* Messages */}
      <div className="flex flex-col gap-3 p-4 min-h-[200px] max-h-[440px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No messages yet. Start the conversation below.
          </p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === currentUserId;
            const { url, username } = avatarFor(msg.sender_id);
            return (
              <div
                key={msg.id}
                className={cn("flex items-end gap-2", isMe && "flex-row-reverse")}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={url ?? undefined} />
                  <AvatarFallback className="bg-[#DFE7D4] text-leaf text-[10px]">
                    {username?.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                    isMe
                      ? "bg-leaf text-white rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  )}
                >
                  {msg.body}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {tradeClosed ? (
        <div className="px-4 py-3 border-t text-xs text-muted-foreground text-center bg-muted/20">
          This trade is closed — chat is read-only.
        </div>
      ) : (
        <form onSubmit={handleSend} className="flex items-end gap-2 p-3 border-t">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSend(e as never);
            }}
            placeholder="Message..."
            rows={1}
            className="flex-1 resize-none px-3 py-2 text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
          />
          <button
            type="submit"
            disabled={!body.trim() || sending}
            className="p-2.5 rounded-xl bg-leaf text-white hover:bg-forest transition-colors disabled:opacity-40 shrink-0"
          >
            <Send size={15} />
          </button>
        </form>
      )}
    </div>
  );
}
