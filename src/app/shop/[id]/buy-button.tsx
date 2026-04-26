"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

export default function BuyButton({ listingId, maxQty }: { listingId: string; maxQty: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [loading, setLoading] = useState(false);

  function decrement() { setQty((q) => Math.max(1, q - 1)); }
  function increment() { setQty((q) => Math.min(maxQty, q + 1)); }

  async function handleBuy() {
    setLoading(true);
    router.push(`/checkout?listing=${listingId}&qty=${qty}`);
  }

  return (
    <div className="space-y-3">
      {maxQty > 1 && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Quantity</span>
          <div className="flex items-center gap-2 border rounded-lg px-1 py-0.5">
            <button
              onClick={decrement}
              disabled={qty <= 1}
              className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors disabled:opacity-40"
            >
              <Minus size={14} />
            </button>
            <span className="w-8 text-center font-medium tabular-nums text-sm">{qty}</span>
            <button
              onClick={increment}
              disabled={qty >= maxQty}
              className="w-7 h-7 flex items-center justify-center hover:bg-muted rounded transition-colors disabled:opacity-40"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      )}
      <Button
        onClick={handleBuy}
        disabled={loading}
        className="bg-green-700 hover:bg-green-800 w-full"
        size="lg"
      >
        {loading ? "Loading…" : "Buy Now"}
      </Button>
    </div>
  );
}
