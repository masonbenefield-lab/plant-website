"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function RelistButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRelist() {
    setLoading(true);
    const res = await fetch("/api/auctions/relist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to relist");
      setLoading(false);
      return;
    }
    toast.success("Auction relisted for 24 hours");
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRelist} disabled={loading}>
      {loading ? "Relisting…" : "Relist"}
    </Button>
  );
}
