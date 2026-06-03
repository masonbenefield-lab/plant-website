"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function GroundbreakerBanner({ spotsLeft }: { spotsLeft: number }) {
  const router = useRouter();
  const [claiming, setClaiming] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  async function claim() {
    setClaiming(true);
    const res = await fetch("/api/auth/claim-groundbreaker", { method: "POST" });
    const data = await res.json();
    setClaiming(false);
    if (data.ok) {
      toast.success("⛏️ You're a Groundbreaker! Nursery plan activated — free forever.");
      router.refresh();
    } else {
      toast.error("Something went wrong — please try again.");
    }
  }

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
      <div>
        <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
          ⛏️ Groundbreaker Early Access — {spotsLeft} of 150 spots left
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
          Claim your free Nursery plan forever + permanent 2% commission rate — lower than any paid tier.
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={claim}
          disabled={claiming}
          className="inline-flex items-center justify-center rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-white text-sm font-semibold px-4 py-1.5 transition-colors"
        >
          {claiming ? "Claiming…" : "Claim now →"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 text-xs underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
