"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function OpenToTradesToggle({
  initialOpenToTrades,
  disclaimerAccepted,
}: {
  initialOpenToTrades: boolean;
  disclaimerAccepted: boolean;
}) {
  const [openToTrades, setOpenToTrades] = useState(initialOpenToTrades);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);
  const [acceptedInSession, setAcceptedInSession] = useState(false);
  const [saving, setSaving] = useState(false);

  async function save(value: boolean, accepted: boolean) {
    setSaving(true);
    const res = await fetch("/api/garden/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        open_to_trades: value,
        disclaimer_accepted: value ? (disclaimerAccepted || accepted) : false,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      toast.error(d.error ?? "Failed to save");
      return false;
    }
    return true;
  }

  async function handleToggle() {
    if (!openToTrades && !disclaimerAccepted && !acceptedInSession) {
      setShowDisclaimer(true);
      return;
    }
    const next = !openToTrades;
    const ok = await save(next, acceptedInSession);
    if (ok) {
      setOpenToTrades(next);
      toast.success(next ? "Trade availability enabled" : "Trade availability disabled");
    }
  }

  async function acceptDisclaimer() {
    setAcceptedInSession(true);
    setDisclaimerChecked(false);
    setShowDisclaimer(false);
    const ok = await save(true, true);
    if (ok) {
      setOpenToTrades(true);
      toast.success("Trade availability enabled");
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5 text-sm font-medium">
            <ArrowLeftRight size={14} className="text-leaf" />
            Open to trades
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Show an "Open to trades" badge on your garden and storefront so others can message you about trading plants.
          </p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={handleToggle}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none disabled:opacity-50",
            openToTrades ? "bg-leaf" : "bg-muted-foreground/30"
          )}
        >
          <span
            className={cn(
              "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform",
              openToTrades ? "translate-x-5" : "translate-x-0"
            )}
          />
        </button>
      </div>

      <Dialog open={showDisclaimer} onOpenChange={setShowDisclaimer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Before you enable trades</DialogTitle>
            <DialogDescription>
              Please read and accept the following before showing your trade availability.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-1">
            <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground leading-relaxed">
              Plantet facilitates connections between users but is not a party to any trade agreement.
              All trades are arranged directly between users at their own risk. Plantet is not responsible
              for items lost, damaged, or misrepresented in private trades.
            </div>
            <label className="flex items-start gap-2.5 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={disclaimerChecked}
                onChange={(e) => setDisclaimerChecked(e.target.checked)}
                className="mt-0.5 accent-leaf h-4 w-4"
              />
              <span>I understand that trades are arranged privately and Plantet is not responsible for the outcome.</span>
            </label>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowDisclaimer(false)}>Cancel</Button>
              <Button
                className="flex-1 bg-leaf hover:bg-forest"
                disabled={!disclaimerChecked}
                onClick={acceptDisclaimer}
              >
                I Agree
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
