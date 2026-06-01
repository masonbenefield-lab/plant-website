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

// Statuses sellers can manually advance to (pending/paid are set by Stripe)
const SELLER_STATUSES: OrderStatus[] = ["shipped", "delivered"];
const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };

export default function OrderStatusSelect({
  orderId,
  currentStatus,
}: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleChange(value: string | null) {
    if (!value) return;
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

  // Nothing to advance to — show a read-only badge instead of an empty dropdown
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
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
