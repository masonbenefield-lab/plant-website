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
import Link from "next/link";
import { ChevronDown, ChevronUp, AlertTriangle, CreditCard } from "lucide-react";
import { ShippingEstimate } from "@/components/shipping-estimate";
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
  free_shipping: boolean | null;
  shipping_cost_cents: number | null;
  shipping_weight_oz: number | null;
}

interface ShippingRate {
  objectId: string;
  provider: string;
  servicelevelName: string;
  servicelevelToken: string;
  amount: string;
  currency: string;
  estimatedDays: number | null;
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
  buyerHasPaymentMethod,
  buyerHasShippingAddress,
  existingOrderStatus,
  recentBids: initialBids,
  showShippingEstimate = false,
}: {
  auction: AuctionData;
  userId: string | null;
  buyerHasPaymentMethod: boolean;
  buyerHasShippingAddress: boolean;
  existingOrderStatus: string | null;
  recentBids: Bid[];
  showShippingEstimate?: boolean;
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
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [savedCard, setSavedCard] = useState<{ brand: string; last4: string } | null>(null);
  const [savedShippingState, setSavedShippingState] = useState<string | null>(null);
  const [orderConfirmed, setOrderConfirmed] = useState(false);
  const [pendingBuyNow, setPendingBuyNow] = useState(false);
  const [buyNowDeclined, setBuyNowDeclined] = useState(false);
  const [liveOrderStatus, setLiveOrderStatus] = useState<string | null>(existingOrderStatus);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`auction:${auction.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${auction.id}` },
        async (payload) => {
          const updated = payload.new as Partial<AuctionData>;
          setAuction((prev) => ({ ...prev, ...updated }));
          // When the auction ends and we're the winner, re-fetch order status so
          // the UI correctly reflects auto-charge success, failure, or pending manual checkout
          if (updated.status === "ended" && updated.current_bidder_id === userId && !liveOrderStatus) {
            const { data: order } = await supabase
              .from("orders")
              .select("status")
              .eq("auction_id", auction.id)
              .eq("buyer_id", userId!)
              .maybeSingle();
            if (order?.status) setLiveOrderStatus(order.status);
          }
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

  // Polling fallback — keeps bids and auction state fresh if Realtime lags
  useEffect(() => {
    async function poll() {
      if (document.hidden) return;
      const supabase = createClient();
      const [{ data: auctionData }, { data: bidData }] = await Promise.all([
        supabase
          .from("auctions")
          .select("current_bid_cents, current_bidder_id, status, ends_at")
          .eq("id", auction.id)
          .single(),
        supabase
          .from("bids")
          .select("id, amount_cents, created_at, bidder:profiles(username)")
          .eq("auction_id", auction.id)
          .order("amount_cents", { ascending: false })
          .limit(10),
      ]);
      if (auctionData) setAuction((prev) => ({ ...prev, ...auctionData }));
      if (bidData) {
        type RawBid = { id: string; amount_cents: number; created_at: string; bidder: { username: string } | { username: string }[] | null };
        setBids((bidData as RawBid[]).map((b) => ({
          id: b.id,
          amount_cents: b.amount_cents,
          created_at: b.created_at,
          bidder: Array.isArray(b.bidder) ? (b.bidder[0] ?? null) : b.bidder,
        })));
      }
    }

    const id = setInterval(poll, 10_000);
    return () => clearInterval(id);
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

  useEffect(() => {
    if (!userId) return;
    fetch("/api/stripe/buyer-profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.card) setSavedCard({ brand: data.card.brand, last4: data.card.last4 });
        if (data.shippingAddress?.state) setSavedShippingState(data.shippingAddress.state);
      })
      .catch(() => {});
  }, [userId]);

  useEffect(() => {
    const ended = auction.status !== "active" || new Date(auction.ends_at) <= new Date();
    if (ended || !userId || !auction.shipping_weight_oz || !buyerHasPaymentMethod || !buyerHasShippingAddress) return;
    setLoadingRates(true);
    fetch(`/api/shipping/auction-rates?auctionId=${auction.id}`)
      .then((r) => r.json())
      .then((data) => {
        const rates: ShippingRate[] = data.rates ?? [];
        setShippingRates(rates);
        if (rates.length > 0) setSelectedRateId(rates[0].objectId);
      })
      .catch(() => {})
      .finally(() => setLoadingRates(false));
  }, [auction.id, auction.status, auction.ends_at, auction.shipping_weight_oz, userId, buyerHasPaymentMethod, buyerHasShippingAddress]);

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
    if (auction.buy_now_price_cents && cents >= auction.buy_now_price_cents) {
      return toast.error(`Bids must be below the Buy Now price (${centsToDisplay(auction.buy_now_price_cents)}). Use Buy Now to purchase immediately.`);
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

    const selectedRate = shippingRates.find((r) => r.objectId === selectedRateId);
    const shippingPayload = selectedRate && auction.shipping_weight_oz ? {
      shippingRateId: selectedRate.objectId,
      shippingService: selectedRate.servicelevelName,
      shippingCarrier: selectedRate.provider,
      shippingCostCents: Math.round(parseFloat(selectedRate.amount) * 100),
      estimatedDays: selectedRate.estimatedDays,
    } : {};

    const res = await fetch("/api/bids/place", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId: auction.id, amountCents: cents, maxBidCents: maxCents, ...shippingPayload }),
    });
    const data = await res.json();
    setPlacing(false);

    if (!res.ok) {
      if (data.error === "card_expired") {
        toast.error("Your saved card has expired — update it in Account Settings before bidding.", {
          duration: 8000,
          action: { label: "Update card", onClick: () => window.location.href = "/account#bidding" },
        });
      } else {
        toast.error(data.error ?? "Failed to place bid");
      }
      return;
    }

    if (data.outbidByProxy) {
      toast.warning(
        `Your bid of ${centsToDisplay(cents)} was placed but immediately outbid by a proxy bid (${centsToDisplay(data.proxyBid)}).`,
        { duration: 6000 }
      );
    } else if (data.wonProxyWar) {
      const extendedNote = data.extended ? " — auction extended 2 min" : "";
      const maxNote = maxCents ? ` · Auto-bidding up to ${centsToDisplay(maxCents)}` : "";
      toast.success(`You won the proxy war! Leading at ${centsToDisplay(data.finalBid)}${extendedNote}${maxNote}`, { duration: 6000 });
    } else {
      const extendedNote = data.extended ? " — auction extended by 2 minutes" : "";
      const maxNote = maxCents ? ` · Auto-bidding up to ${centsToDisplay(maxCents)}` : "";
      toast.success(`Bid of ${centsToDisplay(cents)} placed!${extendedNote}${maxNote}`);
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

  function buyNow() {
    if (!userId) return toast.error("Sign in to buy");
    if (userId === auction.seller_id) return toast.error("You can't buy your own auction");
    if (!auction.buy_now_price_cents) return;
    setPendingBuyNow(true);
  }

  async function confirmBuyNow() {
    setPendingBuyNow(false);
    setPlacing(true);
    const selectedRate = shippingRates.find((r) => r.objectId === selectedRateId);
    const shippingPayload = selectedRate && auction.shipping_weight_oz ? {
      shippingRateId: selectedRate.objectId,
      shippingService: selectedRate.servicelevelName,
      shippingCarrier: selectedRate.provider,
      shippingCostCents: Math.round(parseFloat(selectedRate.amount) * 100),
      estimatedDays: selectedRate.estimatedDays,
    } : {};

    const res = await fetch("/api/bids/buy-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auctionId: auction.id, ...shippingPayload }),
    });
    const data = await res.json();
    setPlacing(false);

    if (!res.ok) {
      if (data.error === "payment_declined") {
        setBuyNowDeclined(true);
      } else {
        toast.error(data.error ?? "Failed to complete purchase");
      }
      return;
    }
    setBuyNowDeclined(false);

    if (data.previousBidderId && data.previousBidderId !== userId) {
      fetch("/api/bids/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId: auction.id, previousBidderId: data.previousBidderId, newBidCents: data.buyNowCents }),
      }).catch(() => {});
    }

    if (data.autoCharged) {
      setOrderConfirmed(true);
      toast.success("Purchase complete — your card has been charged!");
      router.refresh();
    }
  }

  const isEnded = auction.status !== "active" || new Date(auction.ends_at) <= new Date();
  const reserveMet = !auction.reserve_price_cents || auction.current_bid_cents >= auction.reserve_price_cents;
  const isWinner = isEnded && auction.current_bidder_id === userId && reserveMet;
  const msLeft = new Date(auction.ends_at).getTime() - Date.now();
  const isNearEnd = !isEnded && msLeft > 0 && msLeft < 5 * 60 * 1000;
  const minBidForDisplay = auction.current_bid_cents + getMinIncrement(auction.current_bid_cents);

  function isSafetyWarning(cents: number): boolean {
    return cents >= minBidForDisplay * 3;
  }

  function normalizeState(state: string): string {
    const names: Record<string, string> = {
      ALABAMA: "AL", ALASKA: "AK", ARIZONA: "AZ", ARKANSAS: "AR", CALIFORNIA: "CA",
      COLORADO: "CO", CONNECTICUT: "CT", DELAWARE: "DE", FLORIDA: "FL", GEORGIA: "GA",
      HAWAII: "HI", IDAHO: "ID", ILLINOIS: "IL", INDIANA: "IN", IOWA: "IA",
      KANSAS: "KS", KENTUCKY: "KY", LOUISIANA: "LA", MAINE: "ME", MARYLAND: "MD",
      MASSACHUSETTS: "MA", MICHIGAN: "MI", MINNESOTA: "MN", MISSISSIPPI: "MS",
      MISSOURI: "MO", MONTANA: "MT", NEBRASKA: "NE", NEVADA: "NV", "NEW HAMPSHIRE": "NH",
      "NEW JERSEY": "NJ", "NEW MEXICO": "NM", "NEW YORK": "NY", "NORTH CAROLINA": "NC",
      "NORTH DAKOTA": "ND", OHIO: "OH", OKLAHOMA: "OK", OREGON: "OR", PENNSYLVANIA: "PA",
      "RHODE ISLAND": "RI", "SOUTH CAROLINA": "SC", "SOUTH DAKOTA": "SD", TENNESSEE: "TN",
      TEXAS: "TX", UTAH: "UT", VERMONT: "VT", VIRGINIA: "VA", WASHINGTON: "WA",
      "WEST VIRGINIA": "WV", WISCONSIN: "WI", WYOMING: "WY",
    };
    const upper = state.toUpperCase().trim();
    return names[upper] ?? upper;
  }

  function estimateTaxCents(amountCents: number, state: string | null): number | null {
    if (!state) return null;
    const rates: Record<string, number> = { TX: 0.0825 };
    const rate = rates[normalizeState(state)];
    if (rate === undefined) return null;
    return Math.round(amountCents * rate);
  }

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
      <Card className="bg-[#EBF0E6] border-[#C5D4BC] dark:bg-forest/20 dark:border-forest/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Current bid</p>
              <p className="text-2xl font-bold text-leaf">
                {centsToDisplay(auction.current_bid_cents)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Starting: {centsToDisplay(auction.starting_bid_cents)}
              </p>
              {auction.buy_now_price_cents && auction.current_bid_cents < auction.buy_now_price_cents && (
                <p className="text-xs text-orange-600 font-medium mt-0.5">
                  Buy Now: {centsToDisplay(auction.buy_now_price_cents)}
                </p>
              )}
              {auction.reserve_price_cents && (
                auction.current_bid_cents >= auction.reserve_price_cents ? (
                  <p className="text-xs text-leaf font-medium mt-0.5">✓ Reserve met</p>
                ) : (
                  <p className="text-xs text-amber-600 font-medium mt-0.5">Reserve not met</p>
                )
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Time remaining</p>
              <p className={`text-xl font-bold ${isEnded ? "text-red-600" : "text-foreground"}`}>
                {isEnded ? "Ended" : timeLeft}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {isWinner && (liveOrderStatus === "paid" || orderConfirmed) && (
        <a
          href="/orders"
          className={cn(buttonVariants({ size: "lg" }), "w-full bg-leaf hover:bg-forest")}
        >
          Order confirmed — View Order →
        </a>
      )}
      {isWinner && liveOrderStatus === "pending" && (
        <div className="space-y-2">
          <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3 text-center">
            <p className="font-semibold text-red-700 dark:text-red-400 text-sm">Payment failed</p>
            <p className="text-xs text-muted-foreground mt-1">Your saved card could not be charged. Please complete your purchase before the deadline.</p>
          </div>
          <a
            href={`/checkout?auction=${auction.id}`}
            className={cn(buttonVariants({ size: "lg" }), "w-full bg-leaf hover:bg-forest")}
          >
            Complete Purchase →
          </a>
        </div>
      )}
      {isWinner && !liveOrderStatus && !orderConfirmed && buyerHasPaymentMethod && (
        <div className="rounded-lg border border-leaf/40 bg-[#EBF0E6] dark:bg-forest/20 px-4 py-3 text-center">
          <p className="font-semibold text-leaf text-sm">🎉 You won!</p>
          <p className="text-xs text-muted-foreground mt-1">Your saved card will be charged automatically — you&apos;ll receive a confirmation email shortly.</p>
        </div>
      )}
      {isWinner && !liveOrderStatus && !orderConfirmed && !buyerHasPaymentMethod && (
        <a
          href={`/checkout?auction=${auction.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full bg-leaf hover:bg-forest")}
        >
          You won! Complete Purchase →
        </a>
      )}

      {isEnded && auction.current_bidder_id === userId && !reserveMet && !liveOrderStatus && !orderConfirmed && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Reserve not met — you had the highest bid</p>
          <p className="text-xs mt-0.5">The seller may offer to sell at your bid price. You&apos;ll receive an email if they do.</p>
        </div>
      )}

      {!isEnded && userId && userId !== auction.seller_id && !buyerHasPaymentMethod && !buyerHasShippingAddress && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Payment method and delivery address required to bid</p>
          <p className="text-xs mt-0.5">Save a card and delivery address before bidding — your card is charged automatically if you win.</p>
          <a href="/account#bidding" className="text-xs font-semibold underline underline-offset-2 mt-1 inline-block">
            Set up in Account Settings →
          </a>
        </div>
      )}

      {!isEnded && userId && userId !== auction.seller_id && !buyerHasPaymentMethod && buyerHasShippingAddress && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Payment method required to bid</p>
          <p className="text-xs mt-0.5">Save a card in your account settings — your card is charged automatically if you win.</p>
          <a href="/account#bidding" className="text-xs font-semibold underline underline-offset-2 mt-1 inline-block">
            Add a payment method →
          </a>
        </div>
      )}

      {!isEnded && userId && userId !== auction.seller_id && buyerHasPaymentMethod && !buyerHasShippingAddress && (
        <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <p className="font-medium">Delivery address required to bid</p>
          <p className="text-xs mt-0.5">We need your delivery address so the seller knows where to ship your order.</p>
          <a href="/account#bidding" className="text-xs font-semibold underline underline-offset-2 mt-1 inline-block">
            Add delivery address →
          </a>
        </div>
      )}

      {!isEnded && auction.buy_now_price_cents && auction.current_bid_cents < auction.buy_now_price_cents && userId && userId !== auction.seller_id && buyerHasPaymentMethod && buyerHasShippingAddress && (
        <>
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

          {buyNowDeclined && (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800 px-4 py-3">
              <p className="text-sm font-semibold text-red-700 dark:text-red-400">Card declined</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Your saved card was declined. The auction is still open — update your card and try again.</p>
              <a href="/account#bidding" className="text-xs font-semibold underline underline-offset-2 mt-1.5 inline-block text-red-700 dark:text-red-400">
                Update payment method →
              </a>
            </div>
          )}

          {/* Buy Now confirmation dialog */}
          {pendingBuyNow && (() => {
            const selectedRate = shippingRates.find((r) => r.objectId === selectedRateId);
            const bnShippingCents = auction.free_shipping
              ? 0
              : auction.shipping_weight_oz
                ? (selectedRate ? Math.round(parseFloat(selectedRate.amount) * 100) : null)
                : (auction.shipping_cost_cents ?? 0);
            const bnTaxEstimate = estimateTaxCents(
              auction.buy_now_price_cents + (bnShippingCents ?? 0),
              savedShippingState
            );
            const bnTaxCents = bnTaxEstimate ?? 0;
            const bnTotal = bnShippingCents !== null ? auction.buy_now_price_cents + bnShippingCents + bnTaxCents : null;
            const bnCanConfirm = !auction.shipping_weight_oz || !!selectedRate;
            return (
              <div className="rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-900/20 dark:border-orange-800 px-4 py-3 space-y-3">
                <p className="text-sm font-semibold">Confirm Buy Now</p>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Item</span>
                    <span className="font-medium">{centsToDisplay(auction.buy_now_price_cents)}</span>
                  </div>

                  {auction.free_shipping ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-leaf">Free</span>
                    </div>
                  ) : auction.shipping_weight_oz ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        {selectedRate
                          ? <span className="font-medium">{centsToDisplay(Math.round(parseFloat(selectedRate.amount) * 100))}</span>
                          : <span className="text-muted-foreground text-xs italic">Select a method below</span>
                        }
                      </div>
                      <div className="rounded-md border bg-background/60 divide-y">
                        {loadingRates && <p className="text-xs text-muted-foreground px-3 py-2">Loading rates…</p>}
                        {!loadingRates && shippingRates.length === 0 && <p className="text-xs text-muted-foreground px-3 py-2">No rates available — contact the seller.</p>}
                        {shippingRates.map((rate) => (
                          <label key={rate.objectId} className="flex items-center gap-2.5 cursor-pointer px-3 py-2 hover:bg-muted/40 transition-colors">
                            <input type="radio" name="bnShippingRate" value={rate.objectId} checked={selectedRateId === rate.objectId} onChange={() => setSelectedRateId(rate.objectId)} className="accent-leaf shrink-0" />
                            <span className="text-xs flex-1">
                              <span className="font-medium">{rate.provider} {rate.servicelevelName}</span>
                              {rate.estimatedDays ? <span className="text-muted-foreground"> · {rate.estimatedDays}d</span> : null}
                            </span>
                            <span className="text-xs font-semibold shrink-0">${rate.amount}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium">{centsToDisplay(auction.shipping_cost_cents ?? 0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    {bnTaxEstimate !== null
                      ? <span className="font-medium">~{centsToDisplay(bnTaxCents)}</span>
                      : <span className="text-xs text-muted-foreground italic">Calculated at settlement</span>
                    }
                  </div>

                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Total</span>
                    <span>
                      {bnTotal !== null ? centsToDisplay(bnTotal) : "—"}
                      {bnTotal !== null && bnTaxEstimate === null && <span className="text-xs font-normal text-muted-foreground"> + tax</span>}
                    </span>
                  </div>
                </div>

                {savedCard && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CreditCard size={12} className="shrink-0" />
                    <span><span className="capitalize">{savedCard.brand}</span> ••••{savedCard.last4} — will be charged now</span>
                  </div>
                )}

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setPendingBuyNow(false)}>Cancel</Button>
                  <Button size="sm" disabled={!bnCanConfirm || placing} onClick={confirmBuyNow} className="bg-orange-600 hover:bg-orange-700 text-white">
                    {placing ? "Processing…" : "Confirm Purchase"}
                  </Button>
                </div>
              </div>
            );
          })()}
        </>
      )}

      {!isEnded && userId && userId !== auction.seller_id && buyerHasPaymentMethod && buyerHasShippingAddress && (
        <div className="space-y-2">
          {/* Quick bid buttons */}
          <div className="flex gap-2">
            {getQuickBidOptions(auction.current_bid_cents).map((inc) => (
              <button
                key={inc}
                type="button"
                onClick={() => setBidAmount(((auction.current_bid_cents + inc) / 100).toFixed(2))}
                className="flex-1 text-xs font-medium border border-[#A8BF9A] text-leaf rounded-lg py-1.5 hover:bg-[#EBF0E6] transition-colors"
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
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                  <Input
                    id="bid"
                    type="number"
                    min={(minBidForDisplay / 100).toFixed(2)}
                    step="0.01"
                    placeholder={(minBidForDisplay / 100).toFixed(2)}
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    className="pl-6"
                    required
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={placing}
                className="bg-leaf hover:bg-forest"
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
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                    <Input
                      id="maxBid"
                      type="number"
                      min={(minBidForDisplay / 100).toFixed(2)}
                      step="0.01"
                      placeholder={(minBidForDisplay * 5 / 100).toFixed(2)}
                      value={maxBidAmount}
                      onChange={(e) => setMaxBidAmount(e.target.value)}
                      className="pl-6"
                    />
                  </div>
                </div>
              </div>
            )}
          </form>

          {/* Saved card reminder */}
          {savedCard && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1">
              <CreditCard size={12} className="shrink-0" />
              <span>
                <span className="capitalize">{savedCard.brand}</span> ••••{savedCard.last4} — charged automatically if you win
              </span>
            </div>
          )}

          {/* Confirmation step */}
          {pendingConfirm !== null && (() => {
            const selectedRate = shippingRates.find((r) => r.objectId === selectedRateId);
            const shippingCents = auction.free_shipping
              ? 0
              : auction.shipping_weight_oz
                ? (selectedRate ? Math.round(parseFloat(selectedRate.amount) * 100) : null)
                : (auction.shipping_cost_cents ?? 0);
            const canConfirm = !auction.shipping_weight_oz || !!selectedRate;
            const taxEstimate = estimateTaxCents(
              pendingConfirm.cents + (shippingCents ?? 0),
              savedShippingState
            );
            const hasTaxEstimate = taxEstimate !== null;
            const taxEstimateCents = taxEstimate ?? 0;
            const totalCents = shippingCents !== null
              ? pendingConfirm.cents + shippingCents + taxEstimateCents
              : null;
            const reserveNotMet = !!(auction.reserve_price_cents && pendingConfirm.cents < auction.reserve_price_cents);
            const isSelfOutbid = !!userId && auction.current_bidder_id === userId;
            const isWarning = isSafetyWarning(pendingConfirm.cents) || reserveNotMet || isSelfOutbid;
            return (
              <div className={cn(
                "rounded-lg border px-4 py-3 space-y-3",
                isWarning
                  ? "border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800"
                  : "border-[#A8BF9A] bg-[#EBF0E6] dark:bg-forest/20 dark:border-forest"
              )}>
                {isSafetyWarning(pendingConfirm.cents) && (
                  <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} className="shrink-0" />
                    <p className="text-xs font-semibold">
                      This bid is much higher than the minimum ({centsToDisplay(minBidForDisplay)}). Double-check before confirming.
                    </p>
                  </div>
                )}

                {isSelfOutbid && (
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold">
                      You&apos;re already the highest bidder at {centsToDisplay(auction.current_bid_cents)} — this bid increases your commitment.
                    </p>
                  </div>
                )}

                {auction.reserve_price_cents && pendingConfirm.cents < auction.reserve_price_cents && (
                  <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <p className="text-xs font-semibold">
                      Reserve not met — this auction only closes if a bid reaches {centsToDisplay(auction.reserve_price_cents)}. The seller may still accept your bid after the auction ends.
                    </p>
                  </div>
                )}

                <p className="text-sm font-semibold">Confirm bid</p>

                {/* Cost breakdown */}
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Bid</span>
                    <span className="font-medium">{centsToDisplay(pendingConfirm.cents)}</span>
                  </div>

                  {/* Shipping */}
                  {auction.free_shipping ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium text-leaf">Free</span>
                    </div>
                  ) : auction.shipping_weight_oz ? (
                    <div className="space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Shipping</span>
                        {selectedRate
                          ? <span className="font-medium">{centsToDisplay(Math.round(parseFloat(selectedRate.amount) * 100))}</span>
                          : <span className="text-muted-foreground text-xs italic">Select a method below</span>
                        }
                      </div>
                      {/* Rate picker inside dialog */}
                      <div className="rounded-md border bg-background/60 divide-y">
                        {loadingRates && (
                          <p className="text-xs text-muted-foreground px-3 py-2">Loading shipping rates…</p>
                        )}
                        {!loadingRates && shippingRates.length === 0 && (
                          <p className="text-xs text-muted-foreground px-3 py-2">No rates available — contact the seller.</p>
                        )}
                        {shippingRates.map((rate) => (
                          <label key={rate.objectId} className="flex items-center gap-2.5 cursor-pointer px-3 py-2 hover:bg-muted/40 transition-colors">
                            <input
                              type="radio"
                              name="shippingRateConfirm"
                              value={rate.objectId}
                              checked={selectedRateId === rate.objectId}
                              onChange={() => setSelectedRateId(rate.objectId)}
                              className="accent-leaf shrink-0"
                            />
                            <span className="text-xs flex-1">
                              <span className="font-medium">{rate.provider} {rate.servicelevelName}</span>
                              {rate.estimatedDays ? <span className="text-muted-foreground"> · {rate.estimatedDays} day{rate.estimatedDays !== 1 ? "s" : ""}</span> : null}
                            </span>
                            <span className="text-xs font-semibold text-leaf shrink-0">${rate.amount}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Shipping</span>
                      <span className="font-medium">{centsToDisplay(auction.shipping_cost_cents ?? 0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tax</span>
                    {hasTaxEstimate
                      ? <span className="font-medium">~{centsToDisplay(taxEstimateCents)}</span>
                      : <span className="text-xs text-muted-foreground italic">Calculated at settlement</span>
                    }
                  </div>

                  <div className="flex justify-between border-t pt-1.5 font-semibold">
                    <span>Est. Total</span>
                    <span>
                      {totalCents !== null ? centsToDisplay(totalCents) : "—"}
                      {totalCents !== null && !hasTaxEstimate && (
                        <span className="text-xs font-normal text-muted-foreground"> + tax</span>
                      )}
                    </span>
                  </div>
                </div>

                {pendingConfirm.maxCents && (
                  <p className="text-xs text-muted-foreground">
                    Auto-bidding up to {centsToDisplay(pendingConfirm.maxCents)}
                  </p>
                )}

                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => setPendingConfirm(null)}>Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!canConfirm}
                    onClick={confirmBid}
                    className={isWarning
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-leaf hover:bg-forest"
                    }
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            );
          })()}
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
                  {bid.bidder?.username ? (
                    <Link
                      href={`/sellers/${bid.bidder.username}`}
                      className="hover:text-foreground hover:underline underline-offset-2 transition-colors"
                    >
                      {bid.bidder.username}
                    </Link>
                  ) : "Anonymous"}
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

      {showShippingEstimate && (
        <ShippingEstimate
          auctionId={auction.id}
          freeShipping={auction.free_shipping ?? false}
          shippingCostCents={auction.shipping_cost_cents}
        />
      )}

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
            <p><strong className="text-foreground">Winning</strong> — if you win, your saved payment method is automatically charged for the bid amount plus shipping and taxes. No further action required.</p>
          </div>
        )}
      </div>
    </div>
  );
}
