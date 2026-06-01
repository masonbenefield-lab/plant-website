"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { centsToDisplay } from "@/lib/stripe";

type ExpiredOrder = {
  id: string;
  auctionId: string;
  plantName: string;
  winningBidCents: number;
  winnerUsername: string;
  hasSecondBidder: boolean;
};

function ExpiredOrderRow({ order }: { order: ExpiredOrder }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [offered, setOffered] = useState(false);

  async function handleOffer() {
    setLoading(true);
    const res = await fetch("/api/auctions/offer-next-bidder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to send offer");
    } else {
      setOffered(true);
      toast.success("Offer sent to the next bidder — they have 24 hours to complete checkout");
      router.refresh();
    }
  }

  if (offered) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{order.plantName}</span>
        <span>— offer sent to next bidder</span>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="font-semibold text-sm">{order.plantName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Won by <strong>{order.winnerUsername}</strong> for {centsToDisplay(order.winningBidCents)} — payment not completed
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {order.hasSecondBidder ? (
            <Button
              size="sm"
              className="h-8 text-xs bg-leaf hover:bg-forest"
              onClick={handleOffer}
              disabled={loading}
            >
              {loading ? "Sending offer…" : "Offer to next bidder"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic">No other bidders</span>
          )}
          <Button size="sm" variant="outline" className="h-8 text-xs" asChild>
            <Link href="/dashboard/auctions">Relist</Link>
          </Button>
        </div>
      </div>
      {order.hasSecondBidder && (
        <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
          Note: the next bidder will pay their bid amount, which may be less than the winning bid.
        </p>
      )}
    </div>
  );
}

export function ExpiredAuctionBanner({ orders }: { orders: ExpiredOrder[] }) {
  if (orders.length === 0) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
        <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
          {orders.length} auction {orders.length === 1 ? "winner" : "winners"} didn&apos;t complete payment
        </p>
      </div>
      <div className="space-y-3">
        {orders.map((o) => <ExpiredOrderRow key={o.id} order={o} />)}
      </div>
    </div>
  );
}
