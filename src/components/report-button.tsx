"use client";

import { useState } from "react";
import { Flag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

const LISTING_REASONS = [
  "Inaccurate description",
  "Dead or damaged plant",
  "Wrong species or variety",
  "Prohibited item",
  "Spam or duplicate listing",
  "Suspected fraud",
  "Other",
];

const USER_REASONS = [
  "Harassment or threats",
  "Fraud or scam",
  "Fake account",
  "Spam",
  "Inappropriate content",
  "Other",
];

interface ReportButtonProps {
  userId: string | null;
  listingId?: string;
  auctionId?: string;
  reportedUserId?: string;
  targetName: string;
  initialReported?: boolean;
}

export default function ReportButton({
  userId,
  listingId,
  auctionId,
  reportedUserId,
  targetName,
  initialReported = false,
}: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(initialReported);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  const isUserReport = !!reportedUserId;
  const reasons = isUserReport ? USER_REASONS : LISTING_REASONS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) { window.location.href = "/login"; return; }
    if (!reason) return;
    if (details) {
      const hit = findProhibitedWord(details);
      if (hit) {
        toast.error(`Your details contain a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "report-details", details);
        return;
      }
    }
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      listing_id: listingId ?? null,
      auction_id: auctionId ?? null,
      reported_user_id: reportedUserId ?? null,
      reason,
      details: details.trim() || null,
    });

    setLoading(false);
    if (error) {
      if (error.code === "23505") {
        toast.info("You've already reported this.");
        setReported(true);
        setOpen(false);
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("Report submitted — our team will review it shortly.");
    setReported(true);
    setOpen(false);
    setReason("");
    setDetails("");
  }

  if (reported) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
        <Flag size={12} />
        Reported
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
      >
        <Flag size={12} />
        Report
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report {isUserReport ? "user" : "listing"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-1">
            Reporting: <strong className="text-foreground">{targetName}</strong>
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="report-reason">Reason *</Label>
              <select
                id="report-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a reason…</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-details">
                Additional details{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe the issue in more detail…"
                rows={3}
                maxLength={500}
              />
              {details.length > 400 && (
                <p className="text-xs text-muted-foreground text-right">{details.length}/500</p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !reason}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
