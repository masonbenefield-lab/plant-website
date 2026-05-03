"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PauseAllButton({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"pause" | "activate" | null>(null);

  async function pauseAll() {
    setLoading("pause");
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: "paused" })
      .eq("seller_id", sellerId)
      .eq("status", "active");

    setLoading(null);
    if (error) toast.error(error.message);
    else { toast.success("All active listings paused"); router.refresh(); }
  }

  async function activateAll() {
    setLoading("activate");
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: "active" })
      .eq("seller_id", sellerId)
      .eq("status", "paused");

    setLoading(null);
    if (error) toast.error(error.message);
    else { toast.success("All paused listings activated"); router.refresh(); }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={activateAll}
        disabled={loading !== null}
        className="text-xs"
      >
        {loading === "activate" ? "Activating…" : "Activate all"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={pauseAll}
        disabled={loading !== null}
        className="text-xs"
      >
        {loading === "pause" ? "Pausing…" : "Pause all"}
      </Button>
    </div>
  );
}
