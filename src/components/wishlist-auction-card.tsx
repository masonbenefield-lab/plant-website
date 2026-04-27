"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";

interface WishlistAuctionCardProps {
  id: string;
  plant_name: string;
  variety: string | null;
  category: string | null;
  current_bid_cents: number;
  images: string[];
  ends_at: string;
  status: string;
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

export default function WishlistAuctionCard({
  plant_name, variety, category, current_bid_cents, images, ends_at, status,
}: WishlistAuctionCardProps) {
  const timeLeft = useCountdown(ends_at);
  const isActive = status === "active";

  return (
    <Card className={`hover:shadow-md transition-shadow overflow-hidden ${!isActive ? "opacity-60" : ""}`}>
      <div className="relative h-48 bg-muted">
        {images[0] ? (
          <Image src={images[0]} alt={plant_name} fill className="object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-4xl">🌿</div>
        )}
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60">
            <Badge variant="secondary">No longer available</Badge>
          </div>
        )}
        {isActive && (
          <Badge className="absolute top-2 right-2 bg-blue-600">Auction</Badge>
        )}
      </div>
      <CardContent className="p-4">
        {category && (
          <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mb-1.5 text-blue-700 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/40">
            {category}
          </span>
        )}
        <p className="font-semibold truncate">{plant_name}</p>
        {variety && <p className="text-sm text-muted-foreground truncate">{variety}</p>}
        <div className="flex items-center justify-between mt-2">
          <span className="font-bold text-green-700">
            Bid: {centsToDisplay(current_bid_cents)}
          </span>
          {isActive && (
            <span className="text-xs font-semibold text-red-600 tabular-nums">{timeLeft}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
