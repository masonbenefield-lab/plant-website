"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";

export default function BuyButton({
  listingId,
  maxQty,
  buyerNote = "",
  buyerNoteRequired,
}: {
  listingId: string;
  maxQty: number;
  buyerNote?: string;
  buyerNoteRequired?: boolean;
}) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [isPending, startTransition] = useTransition();

  function decrement() { setQty((q) => Math.max(1, q - 1)); }
  function increment() { setQty((q) => Math.min(maxQty, q + 1)); }

  function handleBuy() {
    if (buyerNoteRequired && !buyerNote.trim()) {
      toast.error("Please add a note for the seller");
      return;
    }
    try {
      sessionStorage.setItem(`buyer_note_${listingId}`, buyerNote.trim());
    } catch { /* ignore */ }
    startTransition(() => {
      router.push(`/checkout?listing=${listingId}&qty=${qty}`);
    });
  }

  return (
    <div className="space-y-3">
      {maxQty > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Quantity</span>
          <div className="flex items-center gap-2 border rounded-lg px-1 py-0.5">
            <button
              onClick={decrement}
              disabled={qty <= 1 || isPending}
              className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-medium tabular-nums text-sm">{qty}</span>
            <button
              onClick={increment}
              disabled={qty >= maxQty || isPending}
              className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
      <Button
        onClick={handleBuy}
        disabled={isPending}
        className="bg-leaf hover:bg-forest w-full"
        size="lg"
      >
        {isPending ? "Loading…" : "Buy Now"}
      </Button>
    </div>
  );
}
