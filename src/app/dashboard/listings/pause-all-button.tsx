"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function PauseAllButton({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function pauseAll() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: "paused" })
      .eq("seller_id", sellerId)
      .eq("status", "active");

    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("All active listings paused");
      router.refresh();
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={pauseAll}
      disabled={loading}
      className="text-xs"
    >
      {loading ? "Pausing…" : "Pause all"}
    </Button>
  );
}
