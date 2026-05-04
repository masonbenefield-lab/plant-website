"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

export function BulkOrderActions({
  selectedIds,
  onClear,
}: {
  selectedIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>("shipped");
  const [loading, setLoading] = useState(false);

  if (selectedIds.length === 0) return null;

  async function apply() {
    setLoading(true);
    const res = await fetch("/api/orders/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderIds: selectedIds, status }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success(`${data.count} order${data.count !== 1 ? "s" : ""} marked as ${status}`);
    onClear();
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-muted rounded-lg border">
      <span className="text-sm font-medium">{selectedIds.length} selected</span>
      <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
        <SelectTrigger className="h-8 w-36 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="paid">Mark as Paid</SelectItem>
          <SelectItem value="shipped">Mark as Shipped</SelectItem>
          <SelectItem value="delivered">Mark as Delivered</SelectItem>
        </SelectContent>
      </Select>
      <Button size="sm" onClick={apply} disabled={loading} className="bg-green-700 hover:bg-green-800 h-8">
        {loading ? "Updating…" : "Apply"}
      </Button>
      <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
        Clear selection
      </button>
    </div>
  );
}

export function OrderCheckbox({
  orderId,
  selectedIds,
  onToggle,
}: {
  orderId: string;
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <input
      type="checkbox"
      checked={selectedIds.includes(orderId)}
      onChange={() => onToggle(orderId)}
      className="h-4 w-4 rounded border-gray-300 accent-green-700 cursor-pointer shrink-0 mt-0.5"
      aria-label="Select order"
    />
  );
}
