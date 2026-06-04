"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReviewReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"dismiss" | "delete" | null>(null);

  async function act(action: "dismiss" | "delete") {
    setLoading(action);
    const res = await fetch("/api/admin/review-report-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportId, action }),
    });
    const json = await res.json();
    setLoading(null);
    if (!res.ok) { toast.error(json.error ?? "Something went wrong"); return; }
    toast.success(action === "dismiss" ? "Report dismissed." : "Review deleted.");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => act("dismiss")}
        disabled={!!loading}
      >
        {loading === "dismiss" ? "…" : "Dismiss"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        onClick={() => act("delete")}
        disabled={!!loading}
      >
        {loading === "delete" ? "…" : "Delete review"}
      </Button>
    </div>
  );
}
