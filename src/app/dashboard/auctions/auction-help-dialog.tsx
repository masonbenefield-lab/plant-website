"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function AuctionHelpDialog() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-muted-foreground hover:text-foreground transition-colors"
        title="How auctions work"
      >
        <HelpCircle size={18} />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>How Auctions Work</DialogTitle>
            <DialogDescription>
              A quick guide to creating and managing auctions on Plantet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 mt-2 text-sm">

            <div className="space-y-1.5">
              <p className="font-semibold">Creating an Auction</p>
              <p className="text-muted-foreground">
                Set a starting bid, an end time, and optionally a Buy Now price and a reserve price.
                You can also schedule an auction to go live at a future date and time — handy for
                drops you want to announce in advance.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Bidding &amp; Auto-Close</p>
              <p className="text-muted-foreground">
                Buyers place bids in real time. When the timer hits zero, the auction closes
                automatically and the highest bidder is charged. You&apos;ll receive a payout after
                the order is fulfilled.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Reserve Price</p>
              <p className="text-muted-foreground">
                A reserve is a hidden minimum you&apos;re willing to accept. If the auction ends
                without reaching the reserve, no sale occurs — the auction closes with no winner and
                you can relist the plant. The reserve amount is never shown to buyers.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Buy Now</p>
              <p className="text-muted-foreground">
                If you set a Buy Now price, any bidder can pay it to end the auction immediately
                and win at that price — skipping the timer. Once someone buys now, bidding closes
                and the order is created automatically.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">No Bids / Reserve Not Met</p>
              <p className="text-muted-foreground">
                If an auction ends with no bids, or with bids below your reserve, no order is
                created. The auction moves to Ended with no sale. You can create a new auction for
                the same plant at any time.
              </p>
            </div>

            <div className="space-y-1.5">
              <p className="font-semibold">Canceling an Auction</p>
              <p className="text-muted-foreground">
                You can cancel an active auction before it ends. Any existing bids are voided and
                bidders are notified. Try to avoid canceling auctions with active bids — it creates
                a poor experience for buyers.
              </p>
            </div>

          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
