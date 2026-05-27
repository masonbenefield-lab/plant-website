"use client";

import { useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, X } from "lucide-react";
import { toast } from "sonner";

interface OriginRequest {
  id: string;
  plant_name: string;
  requester_username: string;
}

export function OriginRequestCards({ initialRequests }: { initialRequests: OriginRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [acting, setActing] = useState<string | null>(null);

  async function handleAction(requestId: string, action: "confirm" | "deny") {
    setActing(requestId);
    const res = await fetch(`/api/garden/origin-request/${requestId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    if (!res.ok) {
      toast.error("Something went wrong");
      return;
    }
    setRequests((prev) => prev.filter((r) => r.id !== requestId));
    if (action === "confirm") {
      toast.success("Confirmed! Their plant page now shows you as the source.");
    }
  }

  if (requests.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        Source confirmations
      </p>
      {requests.map((req) => (
        <div
          key={req.id}
          className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 flex-wrap"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <Link href={`/sellers/${req.requester_username}`} className="font-semibold hover:underline hover:text-green-700 transition-colors">
                @{req.requester_username}
              </Link>{" "}
              says they got a{" "}
              <span className="font-semibold">{req.plant_name}</span>{" "}
              from you — is that right?
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => handleAction(req.id, "confirm")}
              disabled={acting === req.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs font-medium hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {acting === req.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <CheckCircle2 size={12} />
              )}
              Confirm
            </button>
            <button
              onClick={() => handleAction(req.id, "deny")}
              disabled={acting === req.id}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <X size={12} />
              Not me
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
