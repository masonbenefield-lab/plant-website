"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AuctionActions({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  async function cancelAuction() {
    setCancelling(true);
    const res = await fetch("/api/auctions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    const data = await res.json();
    setCancelling(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to cancel auction"); return; }
    toast.success("Auction cancelled" + (data.notified > 0 ? ` — ${data.notified} bidder${data.notified !== 1 ? "s" : ""} notified` : ""));
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50">
        Cancel
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel auction?</DialogTitle>
            <DialogDescription>
              This will cancel the auction immediately. Any current bids will be voided. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Keep auction</Button>
            <Button variant="destructive" onClick={cancelAuction} disabled={cancelling} className="flex-1">
              {cancelling ? "Cancelling…" : "Cancel auction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
