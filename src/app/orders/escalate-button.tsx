"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function EscalateButton({ disputeId }: { disputeId: string }) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (done) return <p className="text-xs text-amber-600">Dispute escalated to Plantet</p>;

  return (
    <button
      onClick={async () => {
        setLoading(true);
        const res = await fetch(`/api/orders/dispute/${disputeId}/escalate`, { method: "POST" });
        const data = await res.json();
        setLoading(false);
        if (data.error) {
          toast.error(data.error);
        } else {
          toast.success("Dispute escalated to Plantet — we'll review it and follow up.");
          setDone(true);
        }
      }}
      disabled={loading}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {loading ? "Escalating…" : "Escalate to Plantet →"}
    </button>
  );
}
