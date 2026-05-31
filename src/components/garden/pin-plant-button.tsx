"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pin, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  plantId: string;
  initialPinOrder: number | null;
  onPinChange?: (pinOrder: number | null) => void;
}

export default function PinPlantButton({ plantId, initialPinOrder, onPinChange }: Props) {
  const [pinOrder, setPinOrder] = useState(initialPinOrder);
  const [isPending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const res = await fetch("/api/garden/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Failed to update pin");
        return;
      }
      setPinOrder(data.pinOrder);
      onPinChange?.(data.pinOrder);
      toast.success(data.pinOrder ? `Pinned to slot ${data.pinOrder}` : "Unpinned");
    });
  }

  const isPinned = pinOrder !== null;

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      title={isPinned ? `Pinned #${pinOrder} — click to unpin` : "Pin to community showcase (max 4)"}
      className={cn(
        "w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm text-[10px] font-bold",
        isPinned
          ? "bg-leaf/90 text-white hover:bg-leaf"
          : "bg-black/50 text-white/70 hover:bg-black/70"
      )}
    >
      {isPending ? (
        <Loader2 size={11} className="animate-spin" />
      ) : isPinned ? (
        <span>{pinOrder}</span>
      ) : (
        <Pin size={11} />
      )}
    </button>
  );
}
