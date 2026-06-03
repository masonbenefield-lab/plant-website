"use client";

import { useState } from "react";
import { centsToDisplay } from "@/lib/stripe";

export function PriceBreakdown({
  totalCents,
  shippingCents,
  taxCents,
}: {
  totalCents: number;
  shippingCents: number | null;
  taxCents: number | null;
}) {
  const [open, setOpen] = useState(false);
  const shipping = shippingCents ?? 0;
  const tax = taxCents ?? 0;
  const itemCents = totalCents - shipping - tax;

  const hasBreakdown = shipping > 0 || tax > 0;

  if (!hasBreakdown) {
    return <span>{centsToDisplay(totalCents)}</span>;
  }

  return (
    <span className="inline-block">
      <button
        onClick={() => setOpen((v) => !v)}
        className="underline decoration-dotted underline-offset-2 hover:text-foreground transition-colors"
        title="Click to see price breakdown"
      >
        {centsToDisplay(totalCents)}
      </button>
      {open && (
        <span className="block mt-1.5 text-xs bg-muted rounded-lg px-3 py-2 space-y-1 min-w-[180px] text-left">
          <span className="flex justify-between gap-4">
            <span className="text-muted-foreground">Item</span>
            <span className="font-medium">{centsToDisplay(itemCents)}</span>
          </span>
          {shipping > 0 && (
            <span className="flex justify-between gap-4">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium">{centsToDisplay(shipping)}</span>
            </span>
          )}
          {tax > 0 && (
            <span className="flex justify-between gap-4">
              <span className="text-muted-foreground">Tax</span>
              <span className="font-medium">{centsToDisplay(tax)}</span>
            </span>
          )}
          <span className="flex justify-between gap-4 border-t border-border pt-1 font-semibold">
            <span>Total</span>
            <span>{centsToDisplay(totalCents)}</span>
          </span>
        </span>
      )}
    </span>
  );
}
