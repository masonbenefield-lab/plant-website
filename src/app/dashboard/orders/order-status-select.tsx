"use client";

import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

const SELLER_STATUSES: OrderStatus[] = ["shipped", "delivered"];
const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };

const CONFIRM_MESSAGES: Partial<Record<OrderStatus, { title: string; body: string; action: string }>> = {
  shipped: {
    title: "Mark as shipped?",
    body: "This will notify the buyer that their order is on the way. Only confirm if you have actually shipped the package.",
    action: "Yes, mark as shipped",
  },
  delivered: {
    title: "Mark as delivered?",
    body: "This will notify the buyer that their order has been delivered and open the review window.",
    action: "Yes, mark as delivered",
  },
};

export default function OrderStatusSelect({
  orderId,
  currentStatus,
  trackingNumber,
}: {
  orderId: string;
  currentStatus: OrderStatus;
  trackingNumber?: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [pendingStatus, setPendingStatus] = useState<OrderStatus | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function commitStatus(status: OrderStatus) {
    setConfirming(true);
    const res = await fetch("/api/orders/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status }),
    });
    const data = await res.json();
    setConfirming(false);
    setPendingStatus(null);
    if (!res.ok) toast.error(data.error ?? "Failed to update order");
    else {
      toast.success("Order updated");
      startTransition(() => router.refresh());
    }
  }

  function handleChange(value: string | null) {
    if (!value) return;
    setPendingStatus(value as OrderStatus);
  }

  const forwardStatuses = SELLER_STATUSES.filter(
    (s) => STATUS_RANK[s] > STATUS_RANK[currentStatus]
  );

  if (forwardStatuses.length === 0) {
    return (
      <span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border bg-muted">
        {currentStatus}
      </span>
    );
  }

  const confirmMsg = pendingStatus ? CONFIRM_MESSAGES[pendingStatus] : null;

  return (
    <>
      <select
        defaultValue=""
        onChange={(e) => handleChange(e.target.value || null)}
        className="h-8 w-36 rounded-lg border border-input bg-white px-2 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer dark:bg-gray-800 dark:text-gray-100"
      >
        <option value="" disabled>Mark as…</option>
        {forwardStatuses.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>

      <Dialog open={!!pendingStatus} onOpenChange={(open) => { if (!open) setPendingStatus(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirmMsg?.title}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{confirmMsg?.body}</p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPendingStatus(null)} disabled={confirming}>
              Cancel
            </Button>
            <Button
              className="bg-leaf hover:bg-forest"
              onClick={() => pendingStatus && commitStatus(pendingStatus)}
              disabled={confirming}
            >
              {confirming ? "Updating…" : confirmMsg?.action}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
