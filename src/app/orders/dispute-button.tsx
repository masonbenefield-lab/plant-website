"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

const REASONS = [
  "Item not received",
  "Item arrived damaged",
  "Item not as described",
  "Wrong item sent",
  "Other issue",
];

export default function DisputeButton({ orderId }: { orderId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    if (details) {
      const hit = findProhibitedWord(details);
      if (hit) {
        toast.error(`Your details contain a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "dispute-details", details);
        return;
      }
    }
    setSubmitting(true);
    const res = await fetch("/api/orders/dispute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, reason, details }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success("Your issue has been reported — we'll follow up via email.");
      setOpen(false);
      setReason("");
      setDetails("");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-red-600 hover:underline transition-colors flex items-center gap-1"
      >
        <AlertTriangle size={11} /> Problem with order
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report an Issue</DialogTitle>
            <DialogDescription>
              Describe the problem with your order. We&apos;ll review it and follow up via email.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4 mt-1">
            <div className="space-y-1">
              <Label>What went wrong? *</Label>
              <Select value={reason} onValueChange={v => { if (v) setReason(v); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reason…" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>

              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="dispute-details">Additional details <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea
                id="dispute-details"
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={3}
                placeholder="Describe what happened…"
                maxLength={500}
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={submitting || !reason} className="flex-1 bg-red-600 hover:bg-red-700">
                {submitting ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
