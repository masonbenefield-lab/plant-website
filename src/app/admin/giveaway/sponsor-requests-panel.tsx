"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, MessageSquare, ChevronDown, ChevronUp, Sprout, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Request {
  id: string;
  user_id: string;
  item_name: string;
  message: string | null;
  status: "open" | "closed";
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export function SponsorRequestsPanel({
  requests,
  requesterMap,
}: {
  requests: Request[];
  requesterMap: Record<string, Profile>;
}) {
  const [items, setItems] = useState(requests);
  const [expanded, setExpanded] = useState<string | null>(
    requests.find((r) => r.status === "open")?.id ?? null
  );

  const open = items.filter((r) => r.status === "open");
  const closed = items.filter((r) => r.status === "closed");

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-2">
          <Sprout className="mx-auto text-muted-foreground" size={28} />
          <p className="text-sm text-muted-foreground">No donation requests yet.</p>
        </CardContent>
      </Card>
    );
  }

  function markClosed(id: string) {
    setItems((prev) => prev.map((r) => r.id === id ? { ...r, status: "closed" } : r));
  }

  return (
    <div className="space-y-6">
      {[{ label: "Open", list: open }, { label: "Closed", list: closed }].map(({ label, list }) =>
        list.length === 0 ? null : (
          <div key={label} className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
            {list.map((req) => {
              const user = requesterMap[req.user_id];
              const name = user?.display_name || user?.username || "Unknown";
              const isExpanded = expanded === req.id;
              return (
                <Card key={req.id} className={cn(req.status === "closed" && "opacity-60")}>
                  <CardContent className="p-0">
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left"
                      onClick={() => setExpanded(isExpanded ? null : req.id)}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0 border">
                        {user?.avatar_url ? (
                          <Image src={user.avatar_url} alt={name} width={32} height={32} className="object-cover w-full h-full" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                            {name.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{req.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {name} · {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </p>
                      </div>
                      <span className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                        req.status === "open"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {req.status}
                      </span>
                      {isExpanded ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t px-4 pb-4 pt-3 space-y-4">
                        {req.message && (
                          <div className="rounded-lg bg-muted p-3">
                            <p className="text-xs font-medium text-muted-foreground mb-1">Their message</p>
                            <p className="text-sm leading-relaxed">{req.message}</p>
                          </div>
                        )}
                        {user?.username && (
                          <p className="text-xs text-muted-foreground">
                            Username:{" "}
                            <a href={`/sellers/${user.username}`} target="_blank" className="font-medium hover:underline hover:text-green-700">
                              {user.username}
                            </a>
                          </p>
                        )}
                        {req.status === "open" && (
                          <>
                            <ReplyForm
                              requestId={req.id}
                              recipientId={req.user_id}
                              onReplied={() => markClosed(req.id)}
                            />
                            <CloseButton requestId={req.id} onClosed={() => markClosed(req.id)} />
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

function CloseButton({ requestId, onClosed }: { requestId: string; onClosed: () => void }) {
  const [closing, setClosing] = useState(false);

  async function handleClose() {
    setClosing(true);
    const res = await fetch("/api/admin/sponsor-request-close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
    setClosing(false);
    if (!res.ok) { toast.error("Failed to close request"); return; }
    toast.success("Request closed");
    onClosed();
  }

  return (
    <button
      onClick={handleClose}
      disabled={closing}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
    >
      {closing ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
      Close without replying
    </button>
  );
}

function ReplyForm({ requestId, recipientId, onReplied }: { requestId: string; recipientId: string; onReplied: () => void }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    const res = await fetch("/api/admin/sponsor-request-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, recipientId, body }),
    });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to send"); return; }
    toast.success("Message sent to their inbox");
    setBody("");
    onReplied();
  }

  return (
    <form onSubmit={handleSend} className="space-y-2">
      <label className="text-xs font-medium text-muted-foreground">Reply (sends to their messages inbox)</label>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Hi! Thanks for reaching out about donating…"
        rows={3}
        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
      />
      <button
        type="submit"
        disabled={sending || !body.trim()}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
      >
        {sending ? <Loader2 size={13} className="animate-spin" /> : <MessageSquare size={13} />}
        Send message
      </button>
    </form>
  );
}
