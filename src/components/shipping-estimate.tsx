"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { centsToDisplay } from "@/lib/stripe";
import { Package, Truck } from "lucide-react";

interface ShippoRate {
  objectId: string;
  provider: string;
  servicelevelName: string;
  amount: string;
  estimatedDays: number | null;
}

interface Props {
  listingId?: string;
  auctionId?: string;
  freeShipping: boolean;
  shippingCostCents?: number | null;
}

export function ShippingEstimate({ listingId, auctionId, freeShipping, shippingCostCents }: Props) {
  const [zip, setZip] = useState("");
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<ShippoRate[] | null>(null);
  const [isFreeResult, setIsFreeResult] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (freeShipping) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-green-700 dark:text-green-400 font-medium">
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

  async function estimate() {
    setLoading(true);
    setError(null);
    setRates(null);
    setIsFreeResult(false);

    const res = await fetch("/api/shipping/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ zip: zip.trim(), listingId, auctionId }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Unable to estimate shipping");
      return;
    }
    if (data.freeShipping) {
      setIsFreeResult(true);
      return;
    }
    const sorted = [...(data.rates ?? [])].sort(
      (a: ShippoRate, b: ShippoRate) => parseFloat(a.amount) - parseFloat(b.amount)
    );
    setRates(sorted);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Package size={14} />
        <span>Calculated shipping</span>
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          inputMode="numeric"
          maxLength={5}
          placeholder="ZIP code"
          value={zip}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
            setRates(null);
            setIsFreeResult(false);
            setError(null);
          }}
          onKeyDown={(e) => { if (e.key === "Enter" && zip.length === 5) estimate(); }}
          className="w-28 h-8 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={estimate}
          disabled={loading || zip.length !== 5}
          className="h-8 text-xs px-3"
        >
          {loading ? "…" : "Estimate"}
        </Button>
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {isFreeResult && (
        <p className="text-xs text-green-700 dark:text-green-400 font-medium">
          ✓ Free shipping to this ZIP code
        </p>
      )}

      {rates !== null && rates.length === 0 && !isFreeResult && (
        <p className="text-xs text-muted-foreground">No rates available for this ZIP code.</p>
      )}

      {rates !== null && rates.length > 0 && (
        <div className="rounded-md border text-xs overflow-hidden">
          {rates.map((r) => (
            <div
              key={r.objectId}
              className="flex items-center justify-between px-3 py-1.5 border-b last:border-0"
            >
              <span className="text-muted-foreground">
                {r.provider} {r.servicelevelName}
                {r.estimatedDays ? ` · ${r.estimatedDays}d` : ""}
              </span>
              <span className="font-medium tabular-nums">${parseFloat(r.amount).toFixed(2)}</span>
            </div>
          ))}
          <div className="px-3 py-1.5 bg-muted/40 text-[10px] text-muted-foreground">
            Estimates only — final rate shown at checkout
          </div>
        </div>
      )}
    </div>
  );
}
