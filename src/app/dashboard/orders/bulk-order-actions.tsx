"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { OrderStatus } from "@/lib/supabase/types";

export type BulkOrderInfo = {
  id: string;
  label: string;
  status: string;
};

const STATUS_RANK: Record<string, number> = { pending: 0, paid: 1, shipped: 2, delivered: 3 };

export function BulkOrderActions({
  selectedOrders,
  onClear,
}: {
  selectedOrders: BulkOrderInfo[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [targetStatus, setTargetStatus] = useState<OrderStatus>("shipped");
  const [loading, setLoading] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [trackingMap, setTrackingMap] = useState<Record<string, string>>({});

  if (selectedOrders.length === 0) return null;

  // Only show statuses that are forward-moves for at least one selected order
  const availableStatuses: OrderStatus[] = (["paid", "shipped", "delivered"] as OrderStatus[]).filter(
    (s) => selectedOrders.some((o) => STATUS_RANK[s] > STATUS_RANK[o.status])
  );

  async function applyStatus(status: OrderStatus, tracking?: Record<string, string>) {
    setLoading(true);
    const res = await fetch("/api/orders/bulk-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderIds: selectedOrders.map((o) => o.id),
        status,
        trackingNumbers: tracking ?? {},
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    toast.success(`${data.count} order${data.count !== 1 ? "s" : ""} marked as ${status}`);
    setShowTrackingModal(false);
    setTrackingMap({});
    onClear();
    router.refresh();
  }

  function handleApply() {
    if (targetStatus === "shipped") {
      // Open modal to collect tracking numbers
      setTrackingMap({});
      setShowTrackingModal(true);
    } else {
      applyStatus(targetStatus);
    }
  }

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 bg-muted rounded-lg border">
        <span className="text-sm font-medium">{selectedOrders.length} selected</span>
        <Select value={targetStatus} onValueChange={(v) => setTargetStatus(v as OrderStatus)}>
          <SelectTrigger className="h-8 w-40 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableStatuses.map((s) => (
              <SelectItem key={s} value={s}>
                {s === "paid" ? "Mark as Paid" : s === "shipped" ? "Mark as Shipped" : "Mark as Delivered"}
              </SelectItem>
            ))}
            {availableStatuses.length === 0 && (
              <SelectItem value="shipped" disabled>No forward moves available</SelectItem>
            )}
          </SelectContent>
        </Select>
        <Button size="sm" onClick={handleApply} disabled={loading || availableStatuses.length === 0} className="bg-leaf hover:bg-forest h-8">
          {loading ? "Updating…" : "Apply"}
        </Button>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground ml-auto">
          Clear selection
        </button>
      </div>

      <Dialog open={showTrackingModal} onOpenChange={(open) => { if (!open) setShowTrackingModal(false); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Tracking Numbers</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Enter tracking numbers for each order. Orders without a tracking number will still be marked shipped.
          </p>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {selectedOrders.map((order) => (
              <div key={order.id} className="space-y-1">
                <p className="text-xs font-medium text-foreground truncate">{order.label}</p>
                <Input
                  placeholder="Tracking number (optional)"
                  value={trackingMap[order.id] ?? ""}
                  onChange={(e) => setTrackingMap((prev) => ({ ...prev, [order.id]: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowTrackingModal(false)} disabled={loading}>
              Cancel
            </Button>
            <Button
              className="bg-leaf hover:bg-forest"
              onClick={() => applyStatus("shipped", trackingMap)}
              disabled={loading}
            >
              {loading ? "Marking shipped…" : `Ship ${selectedOrders.length} order${selectedOrders.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
      className="h-4 w-4 rounded border-gray-300 accent-leaf cursor-pointer shrink-0 mt-0.5"
      aria-label="Select order"
    />
  );
}
