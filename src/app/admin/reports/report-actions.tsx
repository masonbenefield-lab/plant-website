"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ReportActionsProps {
  reportId: string;
  listingId: string | null;
  auctionId: string | null;
  reportedUserId: string | null;
  targetName: string;
}


export function ReportActions({ reportId, listingId, auctionId, reportedUserId, targetName }: ReportActionsProps) {
  const router = useRouter();
  const [dismissOpen, setDismissOpen] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleDismiss() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").update({
      status: "dismissed",
      resolved_at: new Date().toISOString(),
      admin_note: note.trim() || null,
    }).eq("id", reportId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report dismissed");
    setDismissOpen(false);
    router.refresh();
  }

  async function handleResolve() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("reports").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      admin_note: note.trim() || null,
    }).eq("id", reportId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Report resolved");
    setResolveOpen(false);
    router.refresh();
  }

  async function handleRemoveAndResolve() {
    setLoading(true);
    const supabase = createClient();

    if (listingId) {
      const { error } = await supabase.from("listings").delete().eq("id", listingId);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else if (auctionId) {
      const { error } = await supabase.from("auctions").update({ status: "cancelled" }).eq("id", auctionId);
      if (error) { toast.error(error.message); setLoading(false); return; }
    } else if (reportedUserId) {
      const { error } = await supabase.from("profiles").update({ deleted_at: new Date().toISOString() }).eq("id", reportedUserId);
      if (error) { toast.error(error.message); setLoading(false); return; }
      // Pause listings and cancel auctions for the archived user
      await Promise.all([
        supabase.from("listings").update({ status: "paused" }).eq("seller_id", reportedUserId).eq("status", "active"),
        supabase.from("auctions").update({ status: "cancelled" }).eq("seller_id", reportedUserId).eq("status", "active"),
      ]);
    }

    await supabase.from("reports").update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      admin_note: note.trim() || null,
    }).eq("id", reportId);

    setLoading(false);
    toast.success("Content removed and report resolved");
    setRemoveOpen(false);
    router.refresh();
  }

  const removeLabel = listingId ? "Delete listing" : auctionId ? "Cancel auction" : "Archive user";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button onClick={() => { setNote(""); setResolveOpen(true); }} className="text-xs text-green-700 hover:underline font-medium">
        Resolve
      </button>
      <button onClick={() => { setNote(""); setRemoveOpen(true); }} className="text-xs text-orange-600 hover:underline font-medium">
        {removeLabel}
      </button>
      <button onClick={() => { setNote(""); setDismissOpen(true); }} className="text-xs text-muted-foreground hover:underline">
        Dismiss
      </button>

      {/* Resolve dialog */}
      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Resolve report</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Mark this report as resolved without removing content.</p>
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="resolve-note">Internal note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="resolve-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for your records…" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setResolveOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleResolve} disabled={loading} className="flex-1 bg-green-700 hover:bg-green-800">
              {loading ? "Saving…" : "Resolve"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove & Resolve dialog */}
      <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{removeLabel}?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will {listingId ? "permanently delete the listing" : auctionId ? "cancel the auction" : "archive the user and pause their content"} for <strong>{targetName}</strong>, then resolve the report.
          </p>
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="remove-note">Internal note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="remove-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for your records…" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setRemoveOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleRemoveAndResolve} disabled={loading} className="flex-1">
              {loading ? "Working…" : removeLabel}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dismiss dialog */}
      <Dialog open={dismissOpen} onOpenChange={setDismissOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Dismiss report</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">No action needed — close this report.</p>
          <div className="space-y-1.5 mt-2">
            <Label htmlFor="dismiss-note">Internal note <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea id="dismiss-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Note for your records…" />
          </div>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setDismissOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleDismiss} disabled={loading} className="flex-1">
              {loading ? "Saving…" : "Dismiss"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
