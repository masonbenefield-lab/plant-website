"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { centsToDisplay } from "@/lib/stripe";
import { getRecentlyViewed } from "./track-view";

interface RecentListing {
  id: string;
  plant_name: string;
  variety: string | null;
  price_cents: number;
  images: string[];
}

export default function RecentlyViewedStrip({ excludeId }: { excludeId?: string }) {
  const [listings, setListings] = useState<RecentListing[]>([]);

  useEffect(() => {
    const ids = getRecentlyViewed().filter((id) => id !== excludeId);
    if (!ids.length) return;
    const supabase = createClient();
    supabase
      .from("listings")
      .select("id, plant_name, variety, price_cents, images")
      .in("id", ids)
      .eq("status", "active")
      .then(({ data }) => {
        if (!data?.length) return;
        const ordered = ids
          .map((id) => data.find((d) => d.id === id))
          .filter((d): d is RecentListing => !!d);
        setListings(ordered);
      });
  }, [excludeId]);

  if (!listings.length) return null;

  return (
    <div className="mb-8">
      <h2 className="text-base font-semibold mb-3 text-muted-foreground">Recently Viewed</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {listings.map((listing) => (
          <Link
            key={listing.id}
            href={`/shop/${listing.id}`}
            className="flex-shrink-0 w-36 rounded-lg border overflow-hidden hover:shadow-md transition-shadow bg-card"
          >
            <div className="relative h-24 bg-muted">
              {listing.images[0] ? (
                <Image src={listing.images[0]} alt={listing.plant_name} fill className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-2xl">🌿</div>
              )}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium truncate">{listing.plant_name}</p>
              {listing.variety && (
                <p className="text-xs text-muted-foreground truncate">{listing.variety}</p>
              )}
              <p className="text-xs font-bold text-green-700 mt-1">{centsToDisplay(listing.price_cents)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
