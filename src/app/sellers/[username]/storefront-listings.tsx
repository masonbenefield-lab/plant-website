"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Heart, Sprout } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";
import { SaveToWishlistButton } from "@/components/garden/save-to-wishlist-button";

type Listing = {
  id: string;
  plant_name: string;
  variety: string | null;
  price_cents: number;
  images: string[];
  quantity: number;
  category: string | null;
  status: string;
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

type GardenPlant = {
  id: string;
  name: string;
  variety: string | null;
  status: string;
  location: string | null;
  planted_at: string | null;
  images: string[] | null;
  public_notes?: string | null;
  pin_order?: number | null;
};

type WishlistItem = {
  id: string;
  name: string;
  variety: string | null;
  notes: string | null;
  priority: string | null;
};

const GARDEN_STATUS_LABEL: Record<string, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const GARDEN_STATUS_COLOR: Record<string, string> = {
  thriving: "bg-[#DFE7D4] text-leaf",
  growing: "bg-emerald-100 text-emerald-700",
  dormant: "bg-yellow-100 text-yellow-700",
  struggling: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-500",
};

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative max-w-sm mb-4">
      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search…"
        className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

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
            ? "bg-leaf text-white border-leaf"
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
              ? "bg-leaf text-white border-leaf"
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
  const [q, setQ] = useState("");
  const activeListings = listings.filter(l => l.status === "active");
  const categories = [...new Set(activeListings.map((l) => l.category).filter(Boolean))] as string[];

  const filtered = listings
    .filter((l) => !cat || l.category === cat)
    .filter((l) =>
      !q.trim() || `${l.plant_name} ${l.variety ?? ""}`.toLowerCase().includes(q.toLowerCase())
    );

  const filteredActive = filtered.filter(l => l.status === "active");
  const filteredSoldOut = filtered.filter(l => l.status === "sold_out");

  if (!listings.length) return <p className="text-muted-foreground">No active listings.</p>;

  const renderCard = (listing: Listing) => {
    const soldOut = listing.status === "sold_out";
    const card = (
      <Card className={cn(
        "hover:shadow-md transition-shadow cursor-pointer",
        !paymentsEnabled && "opacity-90",
        soldOut && "opacity-75"
      )}>
        <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-muted">
          {(listing.images as string[])[0] ? (
            <Image src={(listing.images as string[])[0]} alt={listing.plant_name} fill className="object-cover" />
          ) : null}
          {soldOut && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <span className="bg-white/90 text-gray-800 font-semibold text-sm px-3 py-1 rounded-full">Sold out</span>
            </div>
          )}
        </div>
        <CardContent className="p-4">
          {listing.category && (
            <span className="inline-block text-xs font-medium text-leaf dark:text-sage bg-[#DFE7D4] dark:bg-forest/40 px-2 py-0.5 rounded-full mb-1.5">
              {listing.category}
            </span>
          )}
          <p className="font-semibold">{listing.plant_name}</p>
          {listing.variety && <p className="text-sm text-muted-foreground">{listing.variety}</p>}
          <div className="flex items-center justify-between mt-2">
            <span className={cn("font-bold", soldOut ? "text-muted-foreground" : "text-leaf")}>{centsToDisplay(listing.price_cents)}</span>
            {soldOut
              ? <span className="text-xs text-muted-foreground italic">Currently unavailable</span>
              : paymentsEnabled
              ? <Badge variant="secondary">{listing.quantity} avail.</Badge>
              : <span className="text-xs text-muted-foreground italic">Not available yet</span>
            }
          </div>
        </CardContent>
      </Card>
    );
    return <Link key={listing.id} href={`/shop/${listing.id}`}>{card}</Link>;
  };

  return (
    <>
      <SearchInput value={q} onChange={setQ} />
      <CategoryPills categories={categories} active={cat} onChange={setCat} />
      {filteredActive.length === 0 && filteredSoldOut.length === 0 && (
        <p className="text-muted-foreground">No listings match your search.</p>
      )}
      {filteredActive.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActive.map(renderCard)}
        </div>
      )}
      {filteredSoldOut.length > 0 && (
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4", filteredActive.length > 0 && "mt-6")}>
          {filteredActive.length > 0 && (
            <p className="col-span-full text-xs font-medium text-muted-foreground uppercase tracking-wide">Sold out</p>
          )}
          {filteredSoldOut.map(renderCard)}
        </div>
      )}
    </>
  );
}

export function StorefrontAuctions({ auctions, paymentsEnabled = true }: { auctions: Auction[]; paymentsEnabled?: boolean }) {
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const categories = [...new Set(auctions.map((a) => a.category).filter(Boolean))] as string[];

  const filtered = auctions
    .filter((a) => !cat || a.category === cat)
    .filter((a) =>
      !q.trim() || `${a.plant_name} ${a.variety ?? ""}`.toLowerCase().includes(q.toLowerCase())
    );

  if (!auctions.length) return <p className="text-muted-foreground">No active auctions.</p>;

  return (
    <>
      <SearchInput value={q} onChange={setQ} />
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
                  <span className="font-bold text-leaf">
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
          <p className="text-muted-foreground col-span-full">No auctions match your search.</p>
        )}
      </div>
    </>
  );
}


export function StorefrontGarden({ plants, username, canWishlist }: { plants: GardenPlant[]; username: string; canWishlist?: boolean }) {
  const [q, setQ] = useState("");

  const filtered = plants.filter((p) =>
    !q.trim() || `${p.name} ${p.variety ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  if (!plants.length) return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <Sprout className="mx-auto text-muted-foreground" size={36} />
        <p className="font-medium">No plants added yet</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No plants match your search.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((plant) => (
            <div key={plant.id} className="relative group">
              {canWishlist && (
                <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SaveToWishlistButton plantName={plant.name} variety={plant.variety} overlay />
                </div>
              )}
              <Link href={`/gardens/${username}/${plant.id}?from=storefront`}>
              <Card className="overflow-hidden h-full hover:shadow-md transition-shadow group">
                <div className="aspect-square relative bg-muted">
                  {plant.images?.[0] ? (
                    <Image src={plant.images[0]} alt={plant.name} fill className="object-cover group-hover:scale-[1.02] transition-transform duration-300" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-4xl">🪴</div>
                  )}
                </div>
                <CardContent className="p-3 space-y-1">
                  <p className="font-semibold text-sm leading-tight">{plant.variety || plant.name}</p>
                  {plant.variety && (
                    <p className="text-xs text-muted-foreground">{plant.name}</p>
                  )}
                  <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", GARDEN_STATUS_COLOR[plant.status] ?? "bg-muted text-muted-foreground")}>
                      {GARDEN_STATUS_LABEL[plant.status] ?? plant.status}
                    </span>
                    {plant.location && (
                      <span className="text-xs text-muted-foreground truncate">{plant.location}</span>
                    )}
                  </div>
                  {plant.planted_at && (
                    <p className="text-xs text-muted-foreground">
                      Planted {new Date(plant.planted_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                    </p>
                  )}
                  {plant.public_notes && (
                    <p className="text-xs text-muted-foreground leading-snug line-clamp-3 pt-0.5 border-t mt-1">
                      {plant.public_notes}
                    </p>
                  )}
                </CardContent>
              </Card>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function StorefrontWishlist({ items, canWishlist }: { items: WishlistItem[]; canWishlist?: boolean }) {
  const [q, setQ] = useState("");

  const filtered = items.filter((i) =>
    !q.trim() || `${i.name} ${i.variety ?? ""}`.toLowerCase().includes(q.toLowerCase())
  );

  if (!items.length) return (
    <Card>
      <CardContent className="py-16 text-center space-y-3">
        <Heart className="mx-auto text-muted-foreground" size={36} />
        <p className="font-medium">No wishlist items yet</p>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <SearchInput value={q} onChange={setQ} />
      {filtered.length === 0 ? (
        <p className="text-muted-foreground">No items match your search.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border bg-card px-4 py-3">
              <Heart size={16} className="mt-0.5 shrink-0 text-rose-400" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">{item.name}</span>
                  {item.variety && (
                    <span className="text-xs text-muted-foreground">· {item.variety}</span>
                  )}
                  {item.priority && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded-full font-medium ${
                      item.priority === "must"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300"
                        : item.priority === "want"
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                        : "bg-muted text-muted-foreground"
                    }`}>
                      {item.priority === "must" ? "Must have" : item.priority === "want" ? "Want it" : "Nice to have"}
                    </span>
                  )}
                </div>
                {item.notes && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{item.notes}</p>
                )}
              </div>
              {canWishlist && (
                <div className="shrink-0 self-center">
                  <SaveToWishlistButton plantName={item.name} variety={item.variety} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
