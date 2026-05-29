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
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import type { AuctionStatus } from "@/lib/supabase/types";

interface AuctionData {
  id: string;
  status: AuctionStatus;
  current_bid_cents: number;
  starting_bid_cents: number;
  buy_now_price_cents: number | null;
  reserve_price_cents: number | null;
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

interface PendingConfirm {
  cents: number;
  maxCents: number | null;
}

export default function AuctionBidPanel({
  auction: initialAuction,
  userId,
  buyerStripeOnboarded,
  recentBids: initialBids,
}: {
  auction: AuctionData;
  userId: string | null;
  buyerStripeOnboarded: boolean;
  recentBids: Bid[];
}) {
  const router = useRouter();
  const [auction, setAuction] = useState(initialAuction);
  const [bids, setBids] = useState(initialBids);
  const [bidAmount, setBidAmount] = useState("");
  const [maxBidAmount, setMaxBidAmount] = useState("");
  const [showMaxBid, setShowMaxBid] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");
  const [connected, setConnected] = useState(true);
  const [showAllBids, setShowAllBids] = useState(false);
  const [allBids, setAllBids] = useState<Bid[]>([]);
  const [loadingAllBids, setLoadingAllBids] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);

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

  function getMinIncrement(currentBidCents: number): number {
    if (currentBidCents < 1000)  return 100;
    if (currentBidCents < 5000)  return 200;
    if (currentBidCents < 20000) return 500;
    return 1000;
  }

  function getQuickBidOptions(currentBidCents: number): number[] {
    if (currentBidCents < 1000)  return [100, 200, 500];
    if (currentBidCents < 5000)  return [200, 500, 1000];
    if (currentBidCents < 20000) return [500, 1000, 2500];
    return [1000, 2500, 5000];
  }

  function handleBidSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return toast.error("Sign in to bid");
    if (userId === auction.seller_id) return toast.error("You can't bid on your own auction");
    const cents = dollarsToCents(bidAmount);
    const minIncrement = getMinIncrement(auction.current_bid_cents);
    const minBid = auction.current_bid_cents + minIncrement;
    if (isNaN(cents) || cents < minBid) {
      return toast.error(`Minimum bid is ${centsToDisplay(minBid)}`);
    }

    let maxCents: number | null = null;
    if (showMaxBid && maxBidAmount.trim()) {
      maxCents = dollarsToCents(maxBidAmount);
      if (isNaN(maxCents) || maxCents < cents) {
        return toast.error("Max bid must be at least your current bid amount");
      }
    }

    setPendingConfirm({ cents, maxCents });
  }

  async function confirmBid() {
    if (!pendingConfirm) return;
    const { cents, maxCents } = pendingConfirm;
    setPendingConfirm(null);
    setPlacing(true);
    const res = await fetch("/api/bids/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId: auction.id, amountCents: cents, maxBidCents: maxCents }),
    });
    const data = await res.json();
    setPlacing(false);

    if (!res.ok) {
      toast.error(data.error ?? "Failed to place bid");
      return;
    }

    if (data.outbidByProxy) {
      toast.warning(
        `Your bid of ${centsToDisplay(cents)} was placed but immediately outbid by a proxy bid (${centsToDisplay(data.proxyBid)}).`,
        { duration: 6000 }
      );
    } else {
      toast.success(`Bid of ${centsToDisplay(cents)} placed!`);
      if (maxCents) toast.info(`Auto-bidding enabled up to ${centsToDisplay(maxCents)}`, { duration: 4000 });
      if (data.extended) toast.info("Auction extended — bid placed in final 2 minutes");
    }
    setBidAmount("");
    setMaxBidAmount("");
    setShowMaxBid(false);

    if (!data.outbidByProxy && data.previousBidderId && data.previousBidderId !== userId) {
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
  const minBidForDisplay = auction.current_bid_cents + getMinIncrement(auction.current_bid_cents);

  function isSafetyWarning(cents: number): boolean {
    return cents >= minBidForDisplay * 3;
  }

  return (
    <div className="space-y-4">
      {/* How auctions work — collapsible info */}
      <div className="rounded-md border text-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHowItWorks((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-left text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <span className="font-medium text-foreground">How auctions work</span>
          {showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {showHowItWorks && (
          <div className="px-3 pb-3 pt-1 space-y-2 text-muted-foreground border-t bg-muted/30">
            <p><strong className="text-foreground">Place a bid</strong> — enter any amount above the current bid. The highest bidder when the timer hits zero wins.</p>
            <p><strong className="text-foreground">Max bid (proxy)</strong> — set a maximum you&apos;re willing to pay. The system will automatically bid the minimum increment on your behalf whenever you&apos;re outbid, up to your max.</p>
            <p><strong className="text-foreground">Buy Now</strong> — if the seller set a Buy Now price, you can skip bidding and purchase immediately at that price.</p>
            <p><strong className="text-foreground">Sniping protection</strong> — bids placed in the last 2 minutes extend the auction by 2 minutes, giving everyone a fair chance.</p>
            <p><strong className="text-foreground">No bids = no charge</strong> — if the auction ends with no bids, nothing happens. No payment, no obligation.</p>
            <p><strong className="text-foreground">Winning</strong> — if you win, you&apos;ll see a &quot;Complete Purchase&quot; button to check out with your shipping address.</p>
          </div>
        )}
      </div>

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
              {auction.reserve_price_cents && (
                auction.current_bid_cents >= auction.reserve_price_cents ? (
                  <p className="text-xs text-green-700 font-medium mt-0.5">✓ Reserve met</p>
                ) : (
                  <p className="text-xs text-amber-600 font-medium mt-0.5">Reserve not met</p>
                )
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

      {!isEnded && userId && userId !== auction.seller_id && !buyerStripeOnboarded && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Payment method required to bid</p>
          <p className="text-xs mt-0.5">You need a connected payment account before you can bid or buy.</p>
          <a href="/account#seller-payments" className="text-xs font-semibold underline underline-offset-2 mt-1 inline-block">
            Set up payments →
          </a>
        </div>
      )}

      {!isEnded && auction.buy_now_price_cents && userId && userId !== auction.seller_id && buyerStripeOnboarded && (
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

      {!isEnded && userId && userId !== auction.seller_id && buyerStripeOnboarded && (
        <div className="space-y-2">
          {/* Quick bid buttons */}
          <div className="flex gap-2">
            {getQuickBidOptions(auction.current_bid_cents).map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => setBidAmount(((auction.current_bid_cents + inc) / 100).toFixed(2))}
                className="flex-1 text-xs font-medium border border-green-300 text-green-700 rounded-lg py-1.5 hover:bg-green-50 transition-colors"
              >
                +{centsToDisplay(inc)}
              </button>
            ))}
          </div>

          {/* Bid form */}
          <form onSubmit={handleBidSubmit} className="space-y-2">
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="bid" className="sr-only">Bid amount</Label>
                <Input
                  id="bid"
                  type="number"
                  min={(minBidForDisplay / 100).toFixed(2)}
                  step="0.01"
                  placeholder={`Min ${centsToDisplay(minBidForDisplay)}`}
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
            </div>

            {/* Max bid toggle */}
            <button
              type="button"
              onClick={() => {
                setShowMaxBid((v) => !v);
                if (showMaxBid) setMaxBidAmount("");
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              {showMaxBid ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showMaxBid ? "Hide max bid" : "Set a max bid (optional)"}
            </button>

            {showMaxBid && (
              <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                <div>
                  <Label htmlFor="maxBid" className="text-xs font-medium">Max bid</Label>
                  <p className="text-xs text-muted-foreground mb-1.5">
                    System auto-bids the minimum increment on your behalf whenever you&apos;re outbid, up to this amount.
                  </p>
                  <Input
                    id="maxBid"
                    type="number"
                    min={(minBidForDisplay / 100).toFixed(2)}
                    step="0.01"
                    placeholder={`e.g. ${centsToDisplay(minBidForDisplay * 5)}`}
                    value={maxBidAmount}
                    onChange={(e) => setMaxBidAmount(e.target.value)}
                  />
                </div>
              </div>
            )}
          </form>

          {/* Confirmation step */}
          {pendingConfirm !== null && (
            <div className={cn(
              "rounded-lg border px-4 py-3 space-y-3",
              isSafetyWarning(pendingConfirm.cents)
                ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
                : "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
            )}>
              {isSafetyWarning(pendingConfirm.cents) && (
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={15} className="shrink-0" />
                  <p className="text-xs font-semibold">
                    This bid is much higher than the minimum ({centsToDisplay(minBidForDisplay)}). Double-check before confirming.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    isSafetyWarning(pendingConfirm.cents)
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-green-800 dark:text-green-300"
                  )}>
                    Confirm bid of{" "}
                    <span className="font-bold">{centsToDisplay(pendingConfirm.cents)}</span>?
                  </p>
                  {pendingConfirm.maxCents && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Auto-bidding up to {centsToDisplay(pendingConfirm.maxCents)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setPendingConfirm(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={confirmBid}
                    className={isSafetyWarning(pendingConfirm.cents)
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-green-700 hover:bg-green-800"
                    }
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
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
