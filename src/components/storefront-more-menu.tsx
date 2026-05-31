"use client";

import { useState } from "react";
import { MoreHorizontal, Flag, Ban } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";

const USER_REASONS = [
  "Harassment or threats",
  "Fraud or scam",
  "Fake account",
  "Spam",
  "Inappropriate content",
  "Other",
];

interface Props {
  userId: string;
  reportedUserId: string;
  targetName: string;
  initialReported: boolean;
  initialBlocked: boolean;
}

export function StorefrontMoreMenu({
  userId,
  reportedUserId,
  targetName,
  initialReported,
  initialBlocked,
}: Props) {
  const [reportOpen, setReportOpen] = useState(false);
  const [reported, setReported] = useState(initialReported);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [reportLoading, setReportLoading] = useState(false);

  const [blockOpen, setBlockOpen] = useState(false);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [blockLoading, setBlockLoading] = useState(false);

  async function handleReport(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    if (details) {
      const hit = findProhibitedWord(details);
      if (hit) {
        toast.error(`Your details contain a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "report-details", details);
        return;
      }
    }
    setReportLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").insert({
      reporter_id: userId,
      reported_user_id: reportedUserId,
      reason,
      details: details.trim() || null,
    });
    setReportLoading(false);
    if (error) {
      if (error.code === "23505") { toast.info("You've already reported this user."); setReported(true); setReportOpen(false); return; }
      toast.error(error.message);
      return;
    }
    toast.success("Report submitted — our team will review it shortly.");
    setReported(true);
    setReportOpen(false);
    setReason("");
    setDetails("");
  }

  async function handleBlock(action: "block" | "unblock") {
    setBlockLoading(true);
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId: reportedUserId, action }),
    });
    setBlockLoading(false);
    if (!res.ok) { toast.error("Something went wrong. Please try again."); return; }
    setBlocked(action === "block");
    setBlockOpen(false);
    toast.success(action === "block" ? "User blocked." : "User unblocked.");
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex items-center justify-center w-9 h-9 rounded-md border border-input bg-background hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="More options"
        >
          <MoreHorizontal size={16} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onClick={() => setReportOpen(true)}
            className="gap-2 text-muted-foreground cursor-pointer"
          >
            <Flag size={14} />
            {reported ? "Reported" : "Report"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => blocked ? handleBlock("unblock") : setBlockOpen(true)}
            className="gap-2 text-muted-foreground cursor-pointer"
          >
            <Ban size={14} />
            {blocked ? "Unblock" : "Block"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Report dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report user</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1 mb-1">
            Reporting: <strong className="text-foreground">{targetName}</strong>
          </p>
          <form onSubmit={handleReport} className="space-y-4">
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
                {USER_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-details">
                Additional details <span className="text-muted-foreground font-normal">(optional)</span>
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
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={reportLoading || !reason} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
                {reportLoading ? "Submitting…" : "Submit Report"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Block confirm dialog */}
      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block this user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They won&apos;t be able to message you, bid on your auctions, or purchase your listings. You also won&apos;t see their content.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setBlockOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={() => handleBlock("block")} disabled={blockLoading} className="flex-1 bg-red-600 hover:bg-red-700 text-white">
              {blockLoading ? "Blocking…" : "Block User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
