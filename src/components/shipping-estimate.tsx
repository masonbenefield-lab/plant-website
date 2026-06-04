"use client";

import { centsToDisplay } from "@/lib/stripe";
import { Package, Truck } from "lucide-react";

interface Props {
  freeShipping: boolean;
  shippingCostCents?: number | null;
}

export function ShippingEstimate({ freeShipping, shippingCostCents }: Props) {

  if (freeShipping) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-leaf dark:text-sage font-medium">
        <Truck size={14} />
        Free shipping
      </div>
    );
  }

  if (shippingCostCents != null && shippingCostCents > 0) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Truck size={14} />
        {centsToDisplay(shippingCostCents)} shipping
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Package size={14} />
      <span>Shipping calculated at checkout</span>
    </div>
  );
}
