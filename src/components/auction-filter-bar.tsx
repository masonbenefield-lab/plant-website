"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useRef, Suspense } from "react";
import { X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLANT_CATEGORIES } from "@/lib/categories";
import { POT_SIZES } from "@/lib/pot-sizes";
import PlantInfoCard from "@/components/plant-info-card";

const SORT_OPTIONS = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "bid_asc",     label: "Bid: Low to High" },
  { value: "bid_desc",    label: "Bid: High to Low" },
  { value: "newest",      label: "Newest" },
];

const SOLD_SORT_OPTIONS = [
  { value: "",         label: "Recently Sold" },
  { value: "bid_desc", label: "Price: High to Low" },
  { value: "bid_asc",  label: "Price: Low to High" },
  { value: "most_bids", label: "Most Bids" },
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
  const q          = params.get("q") ?? "";
  const sort       = params.get("sort") ?? "";
  const maxBid     = params.get("max_bid") ?? "";
  const category   = params.get("category") ?? "";
  const location   = params.get("location") ?? "";
  const hasBuyNow  = params.get("has_buy_now") === "1";
  const noBids     = params.get("no_bids") === "1";
  const endsWithin = params.get("ends_within") ?? "";
  const potSize    = params.get("pot_size") ?? "";
  const sold       = params.get("sold") === "1";

  const hasFilters = q || sort || maxBid || category || location || hasBuyNow || noBids || endsWithin || potSize || sold;

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
      next.delete("page");
      for (const [k, v] of Object.entries(patch)) {
        if (v) next.set(k, v);
        else next.delete(k);
      }
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    },
    [params, pathname, router]
  );

  function toggleSold() {
    if (sold) {
      update({ sold: "" });
    } else {
      // Clear live-only filters when switching to sold view
      const next = new URLSearchParams(params.toString());
      next.delete("page");
      next.delete("has_buy_now");
      next.delete("no_bids");
      next.delete("ends_within");
      next.delete("sort");
      next.set("sold", "1");
      startTransition(() => router.replace(`${pathname}?${next.toString()}`));
    }
  }

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function debounce(fn: () => void, ms = 400) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(fn, ms);
  }

  const sortOptions = sold ? SOLD_SORT_OPTIONS : SORT_OPTIONS;

  return (
    <div className="space-y-3 mb-6">
      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="auction-search" className="sr-only">Search auctions or varieties</label>
          <Input
            id="auction-search"
            placeholder={sold ? "Search sold auctions…" : "Search auctions or varieties…"}
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
            {!sold && <option value="">Sort by...</option>}
            {sortOptions.map((o) => (
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

        {/* Max bid / max price */}
        <div>
          <label htmlFor="auction-max-bid" className="sr-only">{sold ? "Max sold price" : "Maximum bid"}</label>
          <Input
            id="auction-max-bid"
            type="number"
            placeholder={sold ? "Max sold price $" : "Budget under $"}
            min={0}
            defaultValue={maxBid}
            className="w-36"
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

        {/* Ending within — hidden in sold mode */}
        {!sold && (
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
        )}

        {/* Pot size */}
        <div>
          <label htmlFor="auction-pot-size" className="sr-only">Filter by pot size</label>
          <select
            id="auction-pot-size"
            value={potSize}
            onChange={(e) => update({ pot_size: e.target.value })}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">Any Size</option>
            {POT_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Has Buy Now — hidden in sold mode */}
        {!sold && (
          <button
            onClick={() => update({ has_buy_now: hasBuyNow ? "" : "1" })}
            className={cn(
              "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
              hasBuyNow
                ? "bg-leaf text-white border-leaf"
                : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
            )}
          >
            Has Buy Now
          </button>
        )}

        {/* No Bids Yet — hidden in sold mode */}
        {!sold && (
          <button
            onClick={() => update({ no_bids: noBids ? "" : "1" })}
            className={cn(
              "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
              noBids
                ? "bg-leaf text-white border-leaf"
                : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
            )}
          >
            No Bids Yet
          </button>
        )}

        {/* Sold toggle */}
        <button
          onClick={toggleSold}
          className={cn(
            "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
            sold
              ? "bg-gray-700 text-white border-gray-700 dark:bg-gray-600 dark:border-gray-600"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
          )}
        >
          Sold
        </button>

      </div>

      <Suspense>
        <PlantInfoCard />
      </Suspense>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {q && (
            <Chip label={`"${q}"`} onRemove={() => update({ q: "" })} />
          )}
          {sort && (
            <Chip label={[...SORT_OPTIONS, ...SOLD_SORT_OPTIONS].find((o) => o.value === sort)?.label ?? sort} onRemove={() => update({ sort: "" })} />
          )}
          {maxBid && (
            <Chip label={sold ? `Max price $${maxBid}` : `Max bid $${maxBid}`} onRemove={() => update({ max_bid: "" })} />
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
          {potSize && (
            <Chip label={`Pot: ${potSize}`} onRemove={() => update({ pot_size: "" })} />
          )}
          {sold && (
            <Chip label="Sold" onRemove={() => update({ sold: "" })} />
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
