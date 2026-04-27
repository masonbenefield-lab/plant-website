"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
    const supabase = createClient();
    const { error } = await supabase
      .from("auctions")
      .update({ status: "cancelled" })
      .eq("id", auctionId)
      .eq("status", "active");
    setCancelling(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Auction cancelled");
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
