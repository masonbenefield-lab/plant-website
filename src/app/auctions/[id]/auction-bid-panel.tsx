"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { centsToDisplay, dollarsToCents } from "@/lib/stripe";
import type { AuctionStatus } from "@/lib/supabase/types";

interface AuctionData {
  id: string;
  status: AuctionStatus;
  current_bid_cents: number;
  starting_bid_cents: number;
  ends_at: string;
  seller_id: string;
  current_bidder_id: string | null;
}

interface Bid {
  id: string;
  amount_cents: number;
  created_at: string;
  bidder: { username: string } | null;
}

export default function AuctionBidPanel({
  auction: initialAuction,
  userId,
  recentBids: initialBids,
}: {
  auction: AuctionData;
  userId: string | null;
  recentBids: Bid[];
}) {
  const router = useRouter();
  const [auction, setAuction] = useState(initialAuction);
  const [bids, setBids] = useState(initialBids);
  const [bidAmount, setBidAmount] = useState("");
  const [placing, setPlacing] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`auction:${auction.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` },
        (payload) => {
          setAuction((prev) => ({ ...prev, ...payload.new as Partial<AuctionData> }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bids", filter: `auction_id=eq.${auction.id}` },
        (payload) => {
          const newBid = payload.new as { id: string; amount_cents: number; created_at: string; bidder_id: string };
          setBids((prev) => [
            { id: newBid.id, amount_cents: newBid.amount_cents, created_at: newBid.created_at, bidder: null },
            ...prev.slice(0, 9),
          ]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [auction.id]);

  useEffect(() => {
    function tick() {
      const diff = new Date(auction.ends_at).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Ended");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [auction.ends_at]);

  async function placeBid(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Sign in to bid");
    if (userId === auction.seller_id) return toast.error("You can't bid on your own auction");

    const cents = dollarsToCents(bidAmount);
    const minBid = auction.current_bid_cents + 1;
    if (cents < minBid) {
      return toast.error(`Bid must be at least ${centsToDisplay(minBid)}`);
    }

    setPlacing(true);
    const supabase = createClient();

    const { error: bidError } = await supabase.from("bids").insert({
      auction_id: auction.id,
      bidder_id: userId,
      amount_cents: cents,
    });

    if (bidError) {
      toast.error(bidError.message);
      setPlacing(false);
      return;
    }

    const now = new Date();
    const endsAt = new Date(auction.ends_at);
    const SNIPE_WINDOW_MS = 2 * 60 * 1000;
    const extended = endsAt.getTime() - now.getTime() < SNIPE_WINDOW_MS;
    if (extended) toast.info("Auction extended — bid placed in final 2 minutes");

    const { error: updateError } = await supabase
      .from("auctions")
      .update({
        current_bid_cents: cents,
        current_bidder_id: userId,
        ...(extended ? { ends_at: new Date(now.getTime() + SNIPE_WINDOW_MS).toISOString() } : {}),
      })
      .eq("id", auction.id)
      .eq("status", "active");

    setPlacing(false);
    if (updateError) {
      toast.error(updateError.message);
    } else {
      toast.success(`Bid of ${centsToDisplay(cents)} placed!`);
      setBidAmount("");
    }
  }

  const isEnded = auction.status !== "active" || new Date(auction.ends_at) <= new Date();
  const isWinner = isEnded && auction.current_bidder_id === userId;

  return (
    <div className="space-y-4">
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current bid</p>
              <p className="text-2xl font-bold text-green-700">
                {centsToDisplay(auction.current_bid_cents)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Starting: {centsToDisplay(auction.starting_bid_cents)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Time remaining</p>
              <p className={`text-xl font-bold ${timeLeft === "Ended" ? "text-red-600" : "text-foreground"}`}>
                {timeLeft}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isWinner && (
        <a
          href={`/checkout?auction=${auction.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full bg-green-700 hover:bg-green-800")}
        >
          You won! Complete Purchase →
        </a>
      )}

      {!isEnded && userId && userId !== auction.seller_id && (
        <form onSubmit={placeBid} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="bid" className="sr-only">Bid amount</Label>
            <Input
              id="bid"
              type="number"
              min={((auction.current_bid_cents + 1) / 100).toFixed(2)}
              step="0.01"
              placeholder={`Min ${centsToDisplay(auction.current_bid_cents + 1)}`}
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            disabled={placing}
            className="bg-green-700 hover:bg-green-800"
          >
            {placing ? "…" : "Place Bid"}
          </Button>
        </form>
      )}

      {!userId && !isEnded && (
        <a
          href="/login"
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Sign in to bid
        </a>
      )}

      {bids.length > 0 && (
        <div>
          <p className="text-sm font-medium mb-2">Recent bids</p>
          <div className="space-y-1">
            {bids.map((bid, i) => (
              <div key={bid.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="text-muted-foreground">
                  {i === 0 && "🏆 "}
                  {bid.bidder?.username ?? "Anonymous"}
                </span>
                <span className="font-medium">{centsToDisplay(bid.amount_cents)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
