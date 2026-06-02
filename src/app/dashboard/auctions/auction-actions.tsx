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

export function DeleteScheduledAuctionButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAuction() {
    setDeleting(true);
    const res = await fetch("/api/auctions/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    const data = await res.json();
    setDeleting(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to delete auction"); return; }
    toast.success("Scheduled auction deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50">
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete scheduled auction?</DialogTitle>
            <DialogDescription>
              This auction hasn&apos;t started yet. Deleting it will remove it permanently and release the inventory allocation.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Keep it</Button>
            <Button variant="destructive" onClick={deleteAuction} disabled={deleting} className="flex-1">
              {deleting ? "Deleting…" : "Delete auction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function DeleteEndedAuctionButton({ auctionId }: { auctionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function deleteAuction() {
    setDeleting(true);
    const res = await fetch("/api/auctions/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId }),
    });
    const data = await res.json();
    setDeleting(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to delete auction"); return; }
    toast.success("Auction deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-red-600 border-red-200 hover:bg-red-50">
        Delete
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete auction?</DialogTitle>
            <DialogDescription>
              This will permanently remove the auction and all its bid history. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Keep it</Button>
            <Button variant="destructive" onClick={deleteAuction} disabled={deleting} className="flex-1">
              {deleting ? "Deleting…" : "Delete auction"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function AcceptHighestBidButton({
  auctionId,
  bidCents,
  plantName,
}: {
  auctionId: string;
  bidCents: number;
  plantName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);

  async function sendOffer() {
    setSending(true);
    const res = await fetch(`/api/auctions/${auctionId}/reserve-offer`, { method: "POST" });
    const data = await res.json();
    setSending(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to send offer"); return; }
    toast.success("Offer sent — the buyer has 48 hours to confirm.");
    setOpen(false);
    router.refresh();
  }

  const dollars = (bidCents / 100).toFixed(2);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="text-leaf border-leaf/40 hover:bg-[#EBF0E6]">
        Accept highest bid
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Accept highest bid on {plantName}?</DialogTitle>
            <DialogDescription>
              The reserve wasn&apos;t met, but you can still accept{" "}
              <strong>${dollars}</strong> — the highest bid. The buyer will
              receive an email and has 48 hours to confirm. You&apos;ll be notified
              if they accept, decline, or let it expire.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={sendOffer} disabled={sending} className="flex-1 bg-leaf hover:bg-forest">
              {sending ? "Sending…" : "Send offer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

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
