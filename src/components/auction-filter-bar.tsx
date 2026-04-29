"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, Suspense } from "react";
import { X, MapPin, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLANT_CATEGORIES } from "@/lib/categories";
import PlantInfoCard from "@/components/plant-info-card";

const SORT_OPTIONS = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "bid_asc",     label: "Bid: Low to High" },
  { value: "bid_desc",    label: "Bid: High to Low" },
  { value: "newest",      label: "Newest" },
];

const ENDS_WITHIN_OPTIONS = [
  { value: "",    label: "Any time" },
  { value: "1h",  label: "Ending in 1 hour" },
  { value: "24h", label: "Ending in 24 hours" },
  { value: "3d",  label: "Ending in 3 days" },
  { value: "7d",  label: "Ending in 7 days" },
];

export default function AuctionFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [showGuide, setShowGuide] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("plant-guide-visible");
    if (stored === "false") setShowGuide(false);
  }, []);

  function toggleGuide() {
    setShowGuide((v) => {
      localStorage.setItem("plant-guide-visible", String(!v));
      return !v;
    });
  }

  const q          = params.get("q") ?? "";
  const sort       = params.get("sort") ?? "ending_soon";
  const maxBid     = params.get("max_bid") ?? "";
  const category   = params.get("category") ?? "";
  const location   = params.get("location") ?? "";
  const hasBuyNow  = params.get("has_buy_now") === "1";
  const noBids     = params.get("no_bids") === "1";
  const endsWithin = params.get("ends_within") ?? "";

  const hasFilters = q || sort !== "ending_soon" || maxBid || category || location || hasBuyNow || noBids || endsWithin;

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      next.delete("page"); // reset to page 1 on filter change
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router]
  );

  let debounceTimer: ReturnType<typeof setTimeout>;
  function debounce(fn: () => void, ms = 400) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, ms);
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="auction-search" className="sr-only">Search auctions or varieties</label>
          <Input
            id="auction-search"
            placeholder="Search auctions or varieties…"
            defaultValue={q}
            onChange={(e) => debounce(() => update({ q: e.target.value }))}
          />
        </div>

        {/* Sort */}
        <div>
          <label htmlFor="auction-sort" className="sr-only">Sort by</label>
          <select
            id="auction-sort"
            value={sort}
            onChange={(e) => update({ sort: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="auction-category" className="sr-only">Filter by category</label>
          <select
            id="auction-category"
            value={category}
            onChange={(e) => update({ category: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All Categories</option>
            {PLANT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Max bid */}
        <div>
          <label htmlFor="auction-max-bid" className="sr-only">Maximum bid</label>
          <Input
            id="auction-max-bid"
            type="number"
            placeholder="Max bid $"
            min={0}
            defaultValue={maxBid}
            className="w-32"
            onChange={(e) => debounce(() => update({ max_bid: e.target.value }))}
          />
        </div>

        {/* Location */}
        <div className="relative">
          <label htmlFor="auction-location" className="sr-only">Filter by location</label>
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="auction-location"
            placeholder="Location (state, country…)"
            defaultValue={location}
            className="pl-8 w-44"
            onChange={(e) => debounce(() => update({ location: e.target.value }))}
          />
        </div>

        {/* Ending within */}
        <div>
          <label htmlFor="auction-ends-within" className="sr-only">Ending within</label>
          <select
            id="auction-ends-within"
            value={endsWithin}
            onChange={(e) => update({ ends_within: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {ENDS_WITHIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Has Buy Now toggle */}
        <button
          onClick={() => update({ has_buy_now: hasBuyNow ? "" : "1" })}
          className={cn(
            "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
            hasBuyNow
              ? "bg-orange-600 text-white border-orange-600"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
          )}
        >
          Has Buy Now
        </button>

        {/* No Bids toggle */}
        <button
          onClick={() => update({ no_bids: noBids ? "" : "1" })}
          className={cn(
            "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
            noBids
              ? "bg-blue-600 text-white border-blue-600"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
          )}
        >
          No Bids Yet
        </button>

        {/* Plant Guide toggle */}
        <button
          onClick={toggleGuide}
          title={showGuide ? "Hide plant guide" : "Show plant guide"}
          className={cn(
            "h-10 px-3 rounded-md border text-sm font-medium transition-colors flex items-center gap-1.5 whitespace-nowrap",
            showGuide
              ? "bg-green-700 text-white border-green-700"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
          )}
        >
          <Leaf size={14} />
          Plant Guide
        </button>
      </div>

      {showGuide && (
        <Suspense>
          <PlantInfoCard />
        </Suspense>
      )}

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {q && (
            <Chip label={`"${q}"`} onRemove={() => update({ q: "" })} />
          )}
          {sort !== "ending_soon" && (
            <Chip label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort} onRemove={() => update({ sort: "" })} />
          )}
          {maxBid && (
            <Chip label={`Max bid $${maxBid}`} onRemove={() => update({ max_bid: "" })} />
          )}
          {category && (
            <Chip label={category} onRemove={() => update({ category: "" })} />
          )}
          {location && (
            <Chip label={`📍 ${location}`} onRemove={() => update({ location: "" })} />
          )}
          {endsWithin && (
            <Chip label={ENDS_WITHIN_OPTIONS.find((o) => o.value === endsWithin)?.label ?? endsWithin} onRemove={() => update({ ends_within: "" })} />
          )}
          {hasBuyNow && (
            <Chip label="Has Buy Now" onRemove={() => update({ has_buy_now: "" })} />
          )}
          {noBids && (
            <Chip label="No Bids Yet" onRemove={() => update({ no_bids: "" })} />
          )}
          <button
            onClick={() => router.replace(pathname)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 bg-muted text-foreground text-xs font-medium px-2.5 py-1 rounded-full">
      {label}
      <button
        onClick={onRemove}
        aria-label={`Remove filter: ${label}`}
        className="hover:text-destructive transition-colors"
      >
        <X size={12} aria-hidden="true" />
      </button>
    </span>
  );
}
