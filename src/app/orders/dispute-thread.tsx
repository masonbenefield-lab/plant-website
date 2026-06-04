"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type DisputeMessage = {
  id: string;
  sender_id: string;
  message: string;
  images: string[];
  created_at: string;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  seller_notified: { label: "Awaiting seller response", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  seller_responded: { label: "Seller responded", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  escalated: { label: "Escalated to Plantet", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  resolved: { label: "Resolved", color: "bg-[#DFE7D4] text-forest" },
};

export default function DisputeThread({
  disputeId,
  initialMessages,
  initialStatus,
  initialLastRepliedByRole,
  initialLastRepliedAt,
  disputeCreatedAt,
  currentUserId,
  isBuyer,
  buyerDisplayName,
  sellerDisplayName,
  canEscalate: initialCanEscalate,
}: {
  disputeId: string;
  initialMessages: DisputeMessage[];
  initialStatus: string;
  initialLastRepliedByRole: string | null;
  initialLastRepliedAt: string | null;
  disputeCreatedAt: string;
  currentUserId: string;
  isBuyer: boolean;
  buyerDisplayName: string;
  sellerDisplayName: string;
  canEscalate: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<DisputeMessage[]>(initialMessages);
  const [status, setStatus] = useState(initialStatus);
  const [lastRepliedByRole, setLastRepliedByRole] = useState(initialLastRepliedByRole);
  const [lastRepliedAt, setLastRepliedAt] = useState(initialLastRepliedAt);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [escalating, setEscalating] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [canEscalate, setCanEscalate] = useState(initialCanEscalate);

  const isClosed = status === "resolved" || status === "escalated";
  const myRole = isBuyer ? "buyer" : "seller";

  // 5-day timeout countdown for the OTHER party's turn
  const otherRole = isBuyer ? "seller" : "buyer";
  // null last_replied_by_role means dispute was just filed — seller's turn
  const isSellersTurn = lastRepliedByRole === "buyer" || lastRepliedByRole === null;
  const isOthersTurn = isBuyer ? isSellersTurn : !isSellersTurn;
  const lastActivity = lastRepliedAt ?? disputeCreatedAt;
  const timeoutDeadline = new Date(new Date(lastActivity).getTime() + 5 * 24 * 60 * 60 * 1000);
  const daysLeft = Math.max(0, Math.ceil((timeoutDeadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  async function sendReply() {
    if (!reply.trim()) return;
    setSending(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: reply.trim() }),
    });
    const data = await res.json();
    setSending(false);
    if (data.error) { toast.error(data.error); return; }
    setMessages(prev => [...prev, { ...data.message, images: data.message.images ?? [] }]);
    setLastRepliedByRole(myRole);
    setLastRepliedAt(new Date().toISOString());
    if (!isBuyer && status === "seller_notified") setStatus("seller_responded");
    setReply("");
    toast.success("Reply sent.");
  }

  async function resolve() {
    setResolving(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/resolve`, { method: "POST" });
    const data = await res.json();
    setResolving(false);
    if (data.error) { toast.error(data.error); return; }
    setStatus("resolved");
    toast.success("Dispute marked as resolved.");
    router.refresh();
  }

  async function escalate() {
    setEscalating(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/escalate`, { method: "POST" });
    const data = await res.json();
    setEscalating(false);
    if (data.error) { toast.error(data.error); return; }
    setStatus("escalated");
    setCanEscalate(false);
    toast.success("Dispute escalated to Plantet.");
    router.refresh();
  }

  async function refund() {
    if (!confirm("Issue a full refund to the buyer? This cannot be undone.")) return;
    setRefunding(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/refund`, { method: "POST" });
    const data = await res.json();
    setRefunding(false);
    if (data.error) { toast.error(data.error); return; }
    setStatus("resolved");
    toast.success("Refund issued. The dispute has been resolved.");
    router.refresh();
  }

  const st = STATUS_LABEL[status] ?? { label: status, color: "bg-gray-100 text-gray-600" };

  return (
    <div className="space-y-4">
      {/* Status badge */}
      <div className="flex items-center justify-between">
        <Badge className={st.color} variant="secondary">{st.label}</Badge>
        {!isClosed && isOthersTurn && (
          <p className="text-xs text-muted-foreground">
            {otherRole === "seller" ? "Seller" : "Buyer"} has {daysLeft} day{daysLeft !== 1 ? "s" : ""} to respond
            {isBuyer && isSellersTurn && daysLeft > 0 && (
              <span className="block mt-0.5">Escalation available once this window closes</span>
            )}
          </p>
        )}
      </div>

      {/* Message thread */}
      <div className="space-y-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          const senderName = msg.sender_id === currentUserId
            ? "You"
            : isBuyer ? sellerDisplayName : buyerDisplayName;
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
              <div className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                isMe
                  ? "bg-leaf text-white rounded-br-sm"
                  : "bg-muted rounded-bl-sm"
              }`}>
                <p className={`text-[10px] font-medium mb-1 ${isMe ? "text-white/70" : "text-muted-foreground"}`}>
                  {senderName}
                </p>
                <p className="whitespace-pre-wrap leading-snug">{msg.message}</p>
                {msg.images?.length > 0 && (
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {msg.images.map((url) => (
                      <a key={url} href={url} target="_blank" rel="noopener noreferrer">
                        <Image
                          src={url}
                          alt="Dispute photo"
                          width={80}
                          height={80}
                          className="rounded-md object-cover border border-white/20"
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
              {msg.created_at && (
                <p className="text-[10px] text-muted-foreground px-1">
                  {new Date(msg.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {" · "}
                  {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              )}
            </div>
          );
        })}

        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">No messages yet.</p>
        )}
      </div>

      {/* Reply box */}
      {!isClosed && (
        <div className="space-y-2 pt-2 border-t">
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Type a reply…"
            rows={2}
            maxLength={1000}
            className="text-sm resize-none"
          />
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" onClick={sendReply} disabled={sending || !reply.trim()} className="h-7 text-xs bg-leaf hover:bg-forest text-white">
                {sending ? "Sending…" : "Send reply"}
              </Button>
              <Button size="sm" variant="outline" onClick={resolve} disabled={resolving} className="h-7 text-xs text-leaf border-leaf/40 hover:bg-leaf/5">
                {resolving ? "Resolving…" : "Mark resolved"}
              </Button>
              {!isBuyer && (
                <Button size="sm" variant="outline" onClick={refund} disabled={refunding} className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50">
                  {refunding ? "Refunding…" : "Issue refund"}
                </Button>
              )}
            </div>
            {isBuyer && canEscalate && (
              <button onClick={escalate} disabled={escalating} className="text-xs text-red-600 hover:underline disabled:opacity-50">
                {escalating ? "Escalating…" : "Escalate to Plantet →"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
