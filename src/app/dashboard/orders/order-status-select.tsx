"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

const SELLER_STATUSES: OrderStatus[] = ["shipped", "delivered"];
const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };

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

  async function handleChange(value: string | null) {
    if (!value) return;

    if ((value === "shipped" || value === "delivered") && !trackingNumber) {
      toast.error("Add a tracking number before marking as shipped");
      return;
    }

    const res = await fetch("/api/orders/update-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, status: value as OrderStatus }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error ?? "Failed to update order");
    else {
      toast.success("Order updated");
      startTransition(() => router.refresh());
    }
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

  return (
    <Select onValueChange={handleChange}>
      <SelectTrigger className="w-36 text-xs h-8">
        <span className="text-muted-foreground">Mark as…</span>
      </SelectTrigger>
      <SelectContent>
        {forwardStatuses.map((s) => (
          <SelectItem key={s} value={s} className="text-xs">
            {s === "shipped" && !trackingNumber ? `${s} (add tracking first)` : s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
