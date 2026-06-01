"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PackageCheck } from "lucide-react";

export default function ConfirmDeliveryButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [, startTransition] = useTransition();

  async function handleConfirm() {
    setLoading(true);
    const res = await fetch("/api/orders/confirm-delivery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Could not confirm delivery");
    } else {
      toast.success("Delivery confirmed — you can now leave a review");
      startTransition(() => router.refresh());
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      className="h-8 text-xs gap-1.5 border-leaf text-leaf hover:bg-leaf hover:text-white"
      disabled={loading}
      onClick={handleConfirm}
    >
      <PackageCheck size={13} />
      {loading ? "Confirming…" : "Mark as Received"}
    </Button>
  );
}
