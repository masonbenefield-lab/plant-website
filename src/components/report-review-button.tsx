"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

const REASONS = [
  { value: "fake",        label: "Not a real customer" },
  { value: "harassment",  label: "Harassment or hate speech" },
  { value: "wrong_order", label: "Wrong order / wrong seller" },
  { value: "other",       label: "Other" },
] as const;

export function ReportReviewButton({
  ratingId,
  initialReported,
}: {
  ratingId: string;
  initialReported: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(initialReported);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (reported) {
    return (
      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
        <Flag size={10} /> Reported
      </span>
    );
  }

  async function handleSubmit() {
    if (!reason) { toast.error("Please select a reason."); return; }
    setSubmitting(true);
    const res = await fetch("/api/ratings/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ratingId, reason, details: details.trim() || undefined }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { toast.error(json.error ?? "Something went wrong."); return; }
    setReported(true);
    setOpen(false);
    toast.success("Review reported. We'll look into it.");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
      >
        <Flag size={10} /> Report
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Report this review</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Select a reason and optionally add more detail. We&apos;ll review it and decide whether to remove it.
          </p>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Reason <span className="text-destructive">*</span></Label>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label
                    key={r.value}
                    className="flex items-center gap-2.5 cursor-pointer rounded-lg border px-3 py-2 text-sm hover:bg-muted transition-colors has-[:checked]:border-destructive has-[:checked]:bg-red-50 dark:has-[:checked]:bg-red-950/20"
                  >
                    <input
                      type="radio"
                      name="reason"
                      value={r.value}
                      checked={reason === r.value}
                      onChange={() => setReason(r.value)}
                      className="accent-red-500"
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Additional details{" "}
                <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                value={details}
                onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                rows={3}
                placeholder="Provide any context that might help us make a decision…"
                className="resize-none text-sm"
              />
              <p className="text-right text-[10px] text-muted-foreground">{details.length}/500</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="destructive" onClick={handleSubmit} disabled={submitting || !reason}>
                {submitting ? "Submitting…" : "Submit report"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
