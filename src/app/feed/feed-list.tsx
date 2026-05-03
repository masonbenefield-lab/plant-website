"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { centsToDisplay } from "@/lib/stripe";

const STORAGE_KEY = "feed_last_visit";

type FeedItem = {
  id: string;
  kind: "listing" | "auction";
  createdAt: string;
  seller_id: string;
  plant_name: string;
  variety: string | null;
  category: string | null;
  images: string[];
  price_cents?: number;
  current_bid_cents?: number;
};

type Seller = {
  id: string;
  username: string;
  avatar_url: string | null;
};

export default function FeedList({ items, sellerMap }: { items: FeedItem[]; sellerMap: Record<string, Seller> }) {
  const lastVisitRef = useRef<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    lastVisitRef.current = stored ? parseInt(stored, 10) : null;
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setReady(true);
  }, []);

  if (!ready) return null;

  const lastVisit = lastVisitRef.current;
  let dividerInserted = false;

  return (
    <div className="space-y-4">
      {items.map(({ id, kind, createdAt, seller_id, plant_name, variety, category, images, price_cents, current_bid_cents }) => {
        const seller = sellerMap[seller_id];
        const href = kind === "listing" ? `/shop/${id}` : `/auctions/${id}`;
        const isNew = lastVisit !== null && new Date(createdAt).getTime() > lastVisit;
        const showDivider = !isNew && !dividerInserted && lastVisit !== null;
        if (showDivider) dividerInserted = true;

        return (
          <div key={id}>
            {showDivider && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 border-t" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">Older items</span>
                <div className="flex-1 border-t" />
              </div>
            )}
            <div className="rounded-2xl border bg-card overflow-hidden hover:shadow-md transition-shadow">
              <Link href={`/sellers/${seller?.username}`} className="flex items-center gap-2 px-4 pt-3 pb-2 hover:bg-muted/40 transition-colors">
                <div className="relative w-7 h-7 rounded-full bg-green-100 overflow-hidden border shrink-0">
                  {seller?.avatar_url ? (
                    <Image src={seller.avatar_url} alt={seller.username} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs font-bold text-green-700">
                      {seller?.username?.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
                <span className="text-sm font-medium">{seller?.username}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {new Date(createdAt).toLocaleDateString()}
                </span>
              </Link>

              <Link href={href} className="flex gap-4 px-4 pb-4">
                <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                  {images[0] ? (
                    <Image src={images[0]} alt={plant_name} fill className="object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-2xl">🌿</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-semibold truncate">{plant_name}</p>
                    {kind === "auction" && (
                      <Badge className="bg-blue-600 text-white text-xs px-1.5 py-0">Auction</Badge>
                    )}
                  </div>
                  {variety && <p className="text-sm text-muted-foreground truncate">{variety}</p>}
                  {category && (
                    <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full mt-1 text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/40">
                      {category}
                    </span>
                  )}
                  <p className="text-sm font-bold text-green-700 mt-1">
                    {price_cents !== undefined
                      ? centsToDisplay(price_cents)
                      : `Bid: ${centsToDisplay(current_bid_cents ?? 0)}`}
                  </p>
                </div>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
