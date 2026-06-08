"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TradeActions({
  tradeId,
  isRecipient,
  isProposer,
}: {
  tradeId: string;
  isRecipient: boolean;
  isProposer: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doAction(action: "accept" | "decline" | "cancel") {
    setLoading(action);
    setError(null);
    const res = await fetch(`/api/trades/${tradeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      setLoading(null);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {isRecipient && (
        <>
          <button
            onClick={() => doAction("accept")}
            disabled={!!loading}
            className="px-4 py-1.5 rounded-lg bg-leaf text-white text-sm font-semibold hover:bg-forest transition-colors disabled:opacity-50"
          >
            {loading === "accept" ? "Accepting..." : "Accept"}
          </button>
          <button
            onClick={() => doAction("decline")}
            disabled={!!loading}
            className="px-4 py-1.5 rounded-lg border text-sm font-medium text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-50"
          >
            {loading === "decline" ? "Declining..." : "Decline"}
          </button>
        </>
      )}
      {isProposer && (
        <button
          onClick={() => doAction("cancel")}
          disabled={!!loading}
          className="px-4 py-1.5 rounded-lg border text-sm font-medium text-muted-foreground hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50"
        >
          {loading === "cancel" ? "Cancelling..." : "Cancel Trade"}
        </button>
      )}
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </div>
  );
}
