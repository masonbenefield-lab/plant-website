"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function DisputeSellerPanel({
  disputeId,
  initialResponse,
  initialStatus,
}: {
  disputeId: string;
  initialResponse: string | null;
  initialStatus: string;
}) {
  const [response, setResponse] = useState(initialResponse ?? "");
  const [status, setStatus] = useState(initialStatus);
  const [savedResponse, setSavedResponse] = useState(initialResponse);
  const [loading, setLoading] = useState(false);

  if (status === "resolved" || status === "escalated") return null;

  async function submitResponse() {
    if (!response.trim()) return;
    setLoading(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ response: response.trim() }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Response sent to buyer.");
    setSavedResponse(response.trim());
    setStatus("seller_responded");
  }

  async function markResolved() {
    setLoading(true);
    const res = await fetch(`/api/orders/dispute/${disputeId}/resolve`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success("Dispute marked as resolved.");
    setStatus("resolved");
  }

  return (
    <div className="space-y-2 pt-1">
      {savedResponse && (
        <div className="text-sm bg-leaf/5 border border-leaf/20 rounded p-3">
          <p className="text-xs font-medium text-leaf mb-1">Your response</p>
          <p>{savedResponse}</p>
        </div>
      )}
      <Textarea
        value={response}
        onChange={e => setResponse(e.target.value)}
        placeholder="Reply to the buyer about this issue…"
        rows={3}
        maxLength={500}
        className="text-sm"
      />
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={submitResponse}
          disabled={loading || !response.trim()}
          className="text-xs h-7"
        >
          {loading ? "Sending…" : savedResponse ? "Update response" : "Send response"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={markResolved}
          disabled={loading}
          className="text-xs h-7 text-leaf border-leaf/40 hover:bg-leaf/5"
        >
          Mark resolved
        </Button>
      </div>
    </div>
  );
}
