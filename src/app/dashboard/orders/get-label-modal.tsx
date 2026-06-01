"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import type { ShippoRate } from "@/lib/shippo";

type Step = "weight" | "rates" | "buying" | "done";

export default function GetLabelModal({
  orderId,
  initialLabelUrl,
}: {
  orderId: string;
  initialLabelUrl: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("weight");
  const [weightOz, setWeightOz] = useState("");
  const [rates, setRates] = useState<ShippoRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [labelUrl, setLabelUrl] = useState(initialLabelUrl);

  if (labelUrl) {
    return (
      <a
        href={labelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest hover:underline"
      >
        <Printer size={13} /> View label
      </a>
    );
  }

  async function fetchRates() {
    const oz = parseFloat(weightOz);
    if (!oz || oz <= 0) { setError("Enter a valid weight in oz"); return; }
    setLoading(true);
    setError("");
    const res = await fetch("/api/shipping/rates-for-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, weightOz: oz }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { setError(data.error); return; }
    setRates(data.rates);
    if (data.weightOz && !weightOz) setWeightOz(String(data.weightOz));
    setSelectedRateId(data.rates[0]?.objectId ?? "");
    setStep("rates");
  }

  async function buyLabel() {
    if (!selectedRateId) { setError("Select a rate first"); return; }
    setStep("buying");
    setError("");
    const res = await fetch("/api/shipping/purchase-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId,
        rateId: selectedRateId,
        rateAmountCents: Math.round(parseFloat(rates.find(r => r.objectId === selectedRateId)?.amount ?? "0") * 100),
      }),
    });
    const data = await res.json();
    if (data.error) {
      setStep("rates");
      setError(data.error);
      return;
    }
    setLabelUrl(data.labelUrl);
    setStep("done");
    setOpen(false);
    toast.success("Label purchased!", {
      description: "Tracking number saved. Click 'View label' to print.",
      action: { label: "View label", onClick: () => window.open(data.labelUrl, "_blank") },
    });
    if (data.labelUrl) window.open(data.labelUrl, "_blank");
    router.refresh();
  }

  function handleOpen() {
    setStep("weight");
    setError("");
    setRates([]);
    setSelectedRateId("");
    setOpen(true);
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleOpen}>
        <Printer size={13} /> Get Label
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Purchase Shipping Label</DialogTitle>
          </DialogHeader>

          {step === "weight" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="weight-oz">Package weight (oz)</Label>
                <div className="flex gap-2">
                  <Input
                    id="weight-oz"
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="e.g. 16"
                    value={weightOz}
                    onChange={e => setWeightOz(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && fetchRates()}
                    className="max-w-[140px]"
                  />
                  <span className="text-sm text-muted-foreground self-center">oz</span>
                </div>
                <p className="text-xs text-muted-foreground">Include packaging. 16 oz = 1 lb.</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={fetchRates} disabled={loading} className="bg-leaf hover:bg-forest w-full">
                {loading ? <><Loader2 size={14} className="animate-spin mr-2" />Fetching rates…</> : "Get Rates"}
              </Button>
            </div>
          )}

          {step === "rates" && (
            <div className="space-y-4">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {rates.map(rate => (
                  <label
                    key={rate.objectId}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                      selectedRateId === rate.objectId
                        ? "border-leaf bg-[#EBF0E6] dark:bg-forest/20"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="rate"
                        value={rate.objectId}
                        checked={selectedRateId === rate.objectId}
                        onChange={() => setSelectedRateId(rate.objectId)}
                        className="accent-leaf"
                      />
                      <div>
                        <p className="text-sm font-medium">{rate.provider} {rate.servicelevelName}</p>
                        {rate.estimatedDays != null && (
                          <p className="text-xs text-muted-foreground">{rate.estimatedDays} business day{rate.estimatedDays !== 1 ? "s" : ""}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-sm font-semibold shrink-0">
                      ${parseFloat(rate.amount).toFixed(2)}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setStep("weight"); setError(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  ← Change weight
                </button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button onClick={buyLabel} disabled={!selectedRateId} className="bg-leaf hover:bg-forest w-full">
                Buy Label — ${rates.find(r => r.objectId === selectedRateId) ? parseFloat(rates.find(r => r.objectId === selectedRateId)!.amount).toFixed(2) : "—"}
              </Button>
            </div>
          )}

          {step === "buying" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 size={28} className="animate-spin text-leaf" />
              <p className="text-sm text-muted-foreground">Purchasing label…</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
