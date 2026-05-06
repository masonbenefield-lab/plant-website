"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { centsToDisplay } from "@/lib/stripe";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

export default function OfferButton({
  listingId,
  listingPriceCents,
  existingOfferStatus,
}: {
  listingId: string;
  listingPriceCents: number;
  existingOfferStatus?: "pending" | "accepted" | "declined" | "withdrawn" | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [offerId, setOfferId] = useState<string | null>(null);

  const hasPendingOffer = existingOfferStatus === "pending" || offerId !== null;
  const wasAccepted = existingOfferStatus === "accepted";

  async function submitOffer() {
    const parsed = parseFloat(amount);
    if (isNaN(parsed) || parsed <= 0) { toast.error("Enter a valid amount"); return; }
    if (message) {
      const hit = findProhibitedWord(message);
      if (hit) {
        toast.error(`Your message contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "offer-message", message);
        return;
      }
    }
    setSubmitting(true);
    const res = await fetch("/api/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, amountDollars: amount, message }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) { toast.error(data.error); return; }
    setOfferId(data.offerId);
    toast.success("Offer sent! The seller will be in touch.");
    setOpen(false);
    router.refresh();
  }

  async function withdrawOffer(id: string) {
    setWithdrawing(true);
    await fetch(`/api/offers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "withdraw" }),
    });
    setWithdrawing(false);
    setOfferId(null);
    toast.success("Offer withdrawn");
    router.refresh();
  }

  if (wasAccepted) {
    return (
      <div className="rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2 text-sm text-green-800 dark:text-green-300">
        ✓ Your offer was accepted!{" "}
        <a href={`/checkout?listing=${listingId}&offer=accepted`} className="font-semibold underline">
          Complete your purchase →
        </a>
      </div>
    );
  }

  if (hasPendingOffer) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
          ✓ Offer pending — waiting for seller response
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground"
          disabled={withdrawing}
          onClick={() => offerId && withdrawOffer(offerId)}
        >
          {withdrawing ? "…" : "Withdraw"}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Make an Offer
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Make an Offer</DialogTitle>
            <DialogDescription>
              Listed at {centsToDisplay(listingPriceCents)}. Offer a lower price — the seller can accept or decline within 48 hours.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1">
              <Label>Your Offer ($)</Label>
              <Input
                type="number"
                min={0.01}
                step={0.01}
                max={(listingPriceCents - 1) / 100}
                placeholder={`Up to ${centsToDisplay(listingPriceCents - 1)}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Message to seller <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Would love this for my collection!"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={2}
                maxLength={300}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button
                onClick={submitOffer}
                disabled={submitting || !amount}
                className="flex-1 bg-green-700 hover:bg-green-800"
              >
                {submitting ? "Sending…" : "Send Offer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
