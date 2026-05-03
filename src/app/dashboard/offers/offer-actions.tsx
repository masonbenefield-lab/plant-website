"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function OfferActions({ offerId }: { offerId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  async function respond(action: "accept" | "decline") {
    setLoading(action);
    const res = await fetch(`/api/offers/${offerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setLoading(null);
    if (data.error) { toast.error(data.error); return; }
    toast.success(action === "accept" ? "Offer accepted — buyer has been emailed!" : "Offer declined");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        className="bg-green-700 hover:bg-green-800"
        disabled={loading !== null}
        onClick={() => respond("accept")}
      >
        {loading === "accept" ? "Accepting…" : "Accept"}
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={loading !== null}
        onClick={() => respond("decline")}
      >
        {loading === "decline" ? "Declining…" : "Decline"}
      </Button>
    </div>
  );
}
