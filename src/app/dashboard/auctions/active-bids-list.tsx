"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { centsToDisplay } from "@/lib/stripe";

type BidAuction = {
  id: string;
  plant_name: string;
  variety: string | null;
  current_bid_cents: number;
  current_bidder_id: string | null;
  status: string;
  ends_at: string;
  created_at: string;
  images: string[] | null;
};

function useCountdown(endsAt: string) {
  const getMs = useCallback(() => new Date(endsAt).getTime() - Date.now(), [endsAt]);
  const [msLeft, setMsLeft] = useState(getMs);

  useEffect(() => {
    setMsLeft(getMs());
    const id = setInterval(() => setMsLeft(getMs()), 1000);
    return () => clearInterval(id);
  }, [getMs]);

  return msLeft;
}

function EndsBadge({ endsAt }: { endsAt: string }) {
  const msLeft = useCountdown(endsAt);
  const twoMin = 2 * 60 * 1000;

  if (msLeft <= 0) {
    return <span className="text-xs font-semibold text-red-600">Ending…</span>;
  }

  if (msLeft <= twoMin) {
    const totalSec = Math.ceil(msLeft / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return (
      <span className="text-xs font-semibold text-red-600 animate-pulse">
        ⏱ {m}m {s}s
      </span>
    );
  }

  return (
    <span>
      Ends:{" "}
      {new Date(endsAt).toLocaleString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}
    </span>
  );
}

export function ActiveBidsList({
  initialAuctions,
  highBidMap,
  userId,
}: {
  initialAuctions: BidAuction[];
  highBidMap: Record<string, number>;
  userId: string;
}) {
  const router = useRouter();
  const [auctions, setAuctions] = useState(initialAuctions);

  useEffect(() => {
    setAuctions(initialAuctions);
  }, [initialAuctions]);

  useEffect(() => {
    if (!auctions.length) return;
    const supabase = createClient();

    const channels = auctions.map((a) =>
      supabase
        .channel(`bid-watch:${a.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "auctions", filter: `id=eq.${a.id}` },
          (payload) => {
            const updated = payload.new as BidAuction;
            setAuctions((prev) =>
              prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x))
            );
            // Also refresh server data if auction ended
            if (updated.status !== "active") router.refresh();
          }
        )
        .subscribe()
    );

    return () => { channels.forEach((c) => supabase.removeChannel(c)); };
  }, [auctions.map((a) => a.id).join(","), router]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!auctions.length) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-lg border border-dashed">
        <div className="text-4xl mb-3">🏷️</div>
        <h2 className="text-lg font-semibold mb-1">No active bids</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-5">
          You aren&apos;t currently bidding on any live auctions. Browse the auction house to find something you like.
        </p>
        <Link
          href="/auctions"
          className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors"
        >
          Browse Auctions →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {auctions.map((a) => {
        const isWinning = a.current_bidder_id === userId;
        const myBid = highBidMap[a.id];
        const img = a.images?.[0];
        return (
          <Link key={a.id} href={`/auctions/${a.id}`}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-lg bg-muted overflow-hidden shrink-0 relative">
                  {img ? (
                    <Image src={img} alt={a.plant_name} fill className="object-cover" sizes="56px" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xl">🌿</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">
                    {a.plant_name}{a.variety ? ` ${a.variety}` : ""}
                  </p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${isWinning ? "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage" : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"}`}>
                      {isWinning ? "Winning" : "Outbid"}
                    </span>
                    <span>Your bid: <span className="font-medium text-foreground">{centsToDisplay(myBid)}</span></span>
                    {!isWinning && (
                      <span>Current: <span className="font-medium text-leaf">{centsToDisplay(a.current_bid_cents)}</span></span>
                    )}
                    <EndsBadge endsAt={a.ends_at} />
                  </div>
                </div>
                <span className="shrink-0 text-sm font-semibold text-leaf underline underline-offset-2">
                  {isWinning ? "View →" : "Bid again →"}
                </span>
              </CardContent>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
