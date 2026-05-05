"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ResumeButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function resume() {
    setLoading(true);
    const res = await fetch("/api/listings/toggle-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to activate"); return; }
    toast.success("Listing activated");
    if (data.notifyRestock) {
      fetch("/api/listings/notify-restock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      }).catch(() => null);
    }
    router.refresh();
  }

  return (
    <button
      onClick={resume}
      disabled={loading}
      className="text-xs font-medium text-green-700 hover:text-green-800 hover:underline disabled:opacity-50"
    >
      {loading ? "Activating…" : "Resume"}
    </button>
  );
}
