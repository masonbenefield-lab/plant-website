"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { centsToDisplay } from "@/lib/stripe";

interface LiveAuctionCardProps {
  id: string;
  plant_name: string;
  variety: string | null;
  current_bid_cents: number;
  bid_count?: number;
  images: string[];
  ends_at: string;
}

function useCountdown(endsAt: string) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const diff = new Date(endsAt).getTime() - Date.now();
      if (diff <= 0) { setLabel("Ended"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setLabel(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  return label;
}

export default function LiveAuctionCard({
  id, plant_name, variety, current_bid_cents, bid_count, images, ends_at,
}: LiveAuctionCardProps) {
  const timeLeft = useCountdown(ends_at);

  return (
    <Link
      href={`/auctions/${id}`}
      className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow flex flex-col"
    >
      <div className="relative h-36 bg-muted">
        {images[0] ? (
          <Image src={images[0]} alt={plant_name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl">🌿</div>
        )}
        <span className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
          Live
        </span>
      </div>
      <div className="p-3 flex-1 flex flex-col gap-1">
        <p className="font-semibold text-sm truncate">{plant_name}</p>
        {variety && <p className="text-xs text-muted-foreground truncate">{variety}</p>}
        <div className="flex items-center justify-between mt-auto pt-2 border-t">
          <div>
            <p className="text-xs text-muted-foreground">
              {bid_count != null && bid_count > 0 ? `${bid_count} bid${bid_count !== 1 ? "s" : ""}` : "Starting bid"}
            </p>
            <p className={`text-sm font-bold ${bid_count != null && bid_count > 0 ? "text-green-700" : "text-muted-foreground"}`}>{centsToDisplay(current_bid_cents)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Ends in</p>
            <p className="text-sm font-bold text-red-600 tabular-nums">{timeLeft}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
