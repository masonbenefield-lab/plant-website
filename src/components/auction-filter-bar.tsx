"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PLANT_CATEGORIES } from "@/lib/categories";

const SORT_OPTIONS = [
  { value: "ending_soon", label: "Ending Soon" },
  { value: "bid_asc",     label: "Bid: Low to High" },
  { value: "bid_desc",    label: "Bid: High to Low" },
  { value: "newest",      label: "Newest" },
];

export default function AuctionFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const q        = params.get("q") ?? "";
  const sort     = params.get("sort") ?? "ending_soon";
  const maxBid   = params.get("max_bid") ?? "";
  const category = params.get("category") ?? "";

  const hasFilters = q || sort !== "ending_soon" || maxBid || category;

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
      </div>

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
