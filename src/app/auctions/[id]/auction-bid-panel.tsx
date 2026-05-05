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
  buy_now_price_cents: number | null;
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
  const [connected, setConnected] = useState(true);
  const [showAllBids, setShowAllBids] = useState(false);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [loadingAllBids, setLoadingAllBids] = useState(false);

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
          // Add immediately with null bidder, then patch with real username
          setBids((prev) => [
            { id: newBid.id, amount_cents: newBid.amount_cents, created_at: newBid.created_at, bidder: null },
            ...prev.slice(0, 9),
          ]);
          supabase
            .from("profiles")
            .select("id, username")
            .eq("id", newBid.bidder_id)
            .single()
            .then(({ data }) => {
              if (data) {
                setBids((prev) =>
                  prev.map((b) => b.id === newBid.id ? { ...b, bidder: data } : b)
                );
              }
            });
        }
      )
      .subscribe((status) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => { supabase.removeChannel(channel); };
  }, [auction.id]);

  // Resync auction state when tab regains focus (handles stale data after tab sleep)
  useEffect(() => {
    async function resync() {
      const supabase = createClient();
      const { data } = await supabase
        .from("auctions")
        .select("current_bid_cents, current_bidder_id, status, ends_at")
        .eq("id", auction.id)
        .single();
      if (data) setAuction((prev) => ({ ...prev, ...data }));
    }

    function handleVisibility() {
      if (!document.hidden) resync();
    }

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
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
    const res = await fetch("/api/bids/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId: auction.id, amountCents: cents }),
    });
    const data = await res.json();
    setPlacing(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to place bid");
      return;
    }

    toast.success(`Bid of ${centsToDisplay(cents)} placed!`);
    if (data.extended) toast.info("Auction extended — bid placed in final 2 minutes");
    setBidAmount("");
    if (data.previousBidderId && data.previousBidderId !== userId) {
      fetch("/api/bids/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, previousBidderId: data.previousBidderId, newBidCents: cents }),
      }).catch(() => {});
    }
  }

  async function buyNow() {
    if (!userId) return toast.error("Sign in to buy");
    if (userId === auction.seller_id) return toast.error("You can't buy your own auction");
    if (!auction.buy_now_price_cents) return;

    setPlacing(true);
    const res = await fetch("/api/bids/buy-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId: auction.id }),
    });
    const data = await res.json();
    setPlacing(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to complete purchase");
      return;
    }

    if (data.previousBidderId && data.previousBidderId !== userId) {
      fetch("/api/bids/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, previousBidderId: data.previousBidderId, newBidCents: data.buyNowCents }),
      }).catch(() => {});
    }
    router.push(`/checkout?auction=${auction.id}`);
  }

  const isEnded = auction.status !== "active" || new Date(auction.ends_at) <= new Date();
  const isWinner = isEnded && auction.current_bidder_id === userId;
  const msLeft = new Date(auction.ends_at).getTime() - Date.now();
  const isNearEnd = !isEnded && msLeft > 0 && msLeft < 5 * 60 * 1000;

  return (
    <div className="space-y-4">
      {!connected && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
          Connection interrupted — live updates paused. Bids may not reflect the latest state.
        </p>
      )}
      {isNearEnd && (
        <p className="text-xs text-orange-700 bg-orange-50 border border-orange-200 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-400 rounded px-3 py-2 font-medium">
          ⚠️ Bids placed in the final 2 minutes extend this auction by 2 minutes.
        </p>
      )}
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
              {auction.buy_now_price_cents && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">
                  Buy Now: {centsToDisplay(auction.buy_now_price_cents)}
                </p>
              )}
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

      {!isEnded && auction.buy_now_price_cents && userId && userId !== auction.seller_id && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/10 dark:border-orange-800 p-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Buy Now</p>
            <p className="text-xs text-muted-foreground">Skip bidding — purchase immediately</p>
          </div>
          <Button
            onClick={buyNow}
            disabled={placing}
            className="bg-orange-600 hover:bg-orange-700 shrink-0"
          >
            {placing ? "…" : `${centsToDisplay(auction.buy_now_price_cents)}`}
          </Button>
        </div>
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
            {(showAllBids ? allBids : bids).map((bid, i) => (
              <div key={bid.id} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                <span className="text-muted-foreground">
                  {i === 0 && "🏆 "}
                  {bid.bidder?.username ?? "Anonymous"}
                </span>
                <span className="font-medium">{centsToDisplay(bid.amount_cents)}</span>
              </div>
            ))}
          </div>
          {!showAllBids && bids.length >= 10 && (
            <button
              onClick={async () => {
                setLoadingAllBids(true);
                const supabase = createClient();
                const { data } = await supabase
                  .from("bids")
                  .select("id, amount_cents, created_at, bidder:profiles(username)")
                  .eq("auction_id", auction.id)
                  .order("amount_cents", { ascending: false });
                type RawBid = { id: string; amount_cents: number; created_at: string; bidder: { username: string } | { username: string }[] | null };
                setAllBids((data as RawBid[] ?? []).map(b => ({
                  id: b.id,
                  amount_cents: b.amount_cents,
                  created_at: b.created_at,
                  bidder: Array.isArray(b.bidder) ? (b.bidder[0] ?? null) : b.bidder,
                })));
                setShowAllBids(true);
                setLoadingAllBids(false);
              }}
              disabled={loadingAllBids}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              {loadingAllBids ? "Loading…" : "Show all bids"}
            </button>
          )}
          {showAllBids && (
            <button
              onClick={() => setShowAllBids(false)}
              className="mt-2 text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
