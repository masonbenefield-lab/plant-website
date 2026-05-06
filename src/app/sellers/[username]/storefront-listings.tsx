"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";

type Listing = {
  id: string;
  plant_name: string;
  variety: string | null;
  price_cents: number;
  images: string[];
  quantity: number;
  category: string | null;
};

type Auction = {
  id: string;
  plant_name: string;
  variety: string | null;
  current_bid_cents: number;
  images: string[];
  ends_at: string;
  category: string | null;
};

function CategoryPills({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (cat: string) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-5">
      <button
        onClick={() => onChange("")}
        className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
          active === ""
            ? "bg-green-700 text-white border-green-700"
            : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
            active === c
              ? "bg-green-700 text-white border-green-700"
              : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

export function StorefrontListings({ listings, paymentsEnabled = true }: { listings: Listing[]; paymentsEnabled?: boolean }) {
  const [cat, setCat] = useState("");
  const categories = [...new Set(listings.map((l) => l.category).filter(Boolean))] as string[];
  const filtered = cat ? listings.filter((l) => l.category === cat) : listings;

  if (!listings.length) return <p className="text-muted-foreground">No active listings.</p>;

  return (
    <>
      <CategoryPills categories={categories} active={cat} onChange={setCat} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((listing) => {
          const card = (
            <Card className={paymentsEnabled ? "hover:shadow-md transition-shadow cursor-pointer" : "opacity-90"}>
              {(listing.images as string[])[0] && (
                <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                  <Image src={(listing.images as string[])[0]} alt={listing.plant_name} fill className="object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                {listing.category && (
                  <span className="inline-block text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/40 px-2 py-0.5 rounded-full mb-1.5">
                    {listing.category}
                  </span>
                )}
                <p className="font-semibold">{listing.plant_name}</p>
                {listing.variety && <p className="text-sm text-muted-foreground">{listing.variety}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-green-700">{centsToDisplay(listing.price_cents)}</span>
                  {paymentsEnabled
                    ? <Badge variant="secondary">{listing.quantity} avail.</Badge>
                    : <span className="text-xs text-muted-foreground italic">Not available yet</span>
                  }
                </div>
              </CardContent>
            </Card>
          );
          return paymentsEnabled
            ? <Link key={listing.id} href={`/shop/${listing.id}`}>{card}</Link>
            : <div key={listing.id}>{card}</div>;
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full">No listings in this category.</p>
        )}
      </div>
    </>
  );
}

export function StorefrontAuctions({ auctions, paymentsEnabled = true }: { auctions: Auction[]; paymentsEnabled?: boolean }) {
  const [cat, setCat] = useState("");
  const categories = [...new Set(auctions.map((a) => a.category).filter(Boolean))] as string[];
  const filtered = cat ? auctions.filter((a) => a.category === cat) : auctions;

  if (!auctions.length) return <p className="text-muted-foreground">No active auctions.</p>;

  return (
    <>
      <CategoryPills categories={categories} active={cat} onChange={setCat} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((auction) => {
          const card = (
            <Card className={paymentsEnabled ? "hover:shadow-md transition-shadow cursor-pointer" : "opacity-90"}>
              {(auction.images as string[])[0] && (
                <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                  <Image src={(auction.images as string[])[0]} alt={auction.plant_name} fill className="object-cover" />
                </div>
              )}
              <CardContent className="p-4">
                {auction.category && (
                  <span className="inline-block text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full mb-1.5">
                    {auction.category}
                  </span>
                )}
                <p className="font-semibold">{auction.plant_name}</p>
                {auction.variety && <p className="text-sm text-muted-foreground">{auction.variety}</p>}
                <div className="flex items-center justify-between mt-2">
                  <span className="font-bold text-green-700">
                    {paymentsEnabled ? `Bid: ${centsToDisplay(auction.current_bid_cents)}` : centsToDisplay(auction.current_bid_cents)}
                  </span>
                  {paymentsEnabled
                    ? <span className="text-xs text-muted-foreground">Ends {new Date(auction.ends_at).toLocaleDateString()}</span>
                    : <span className="text-xs text-muted-foreground italic">Not available yet</span>
                  }
                </div>
              </CardContent>
            </Card>
          );
          return paymentsEnabled
            ? <Link key={auction.id} href={`/auctions/${auction.id}`}>{card}</Link>
            : <div key={auction.id}>{card}</div>;
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full">No auctions in this category.</p>
        )}
      </div>
    </>
  );
}
