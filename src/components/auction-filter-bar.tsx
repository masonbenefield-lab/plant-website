"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";

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

  const q       = params.get("q") ?? "";
  const sort    = params.get("sort") ?? "ending_soon";
  const maxBid  = params.get("max_bid") ?? "";

  const hasFilters = q || sort !== "ending_soon" || maxBid;

  const update = useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(params.toString());
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
          <Input
            placeholder="Search auctions or varieties…"
            defaultValue={q}
            onChange={(e) => debounce(() => update({ q: e.target.value }))}
          />
        </div>

        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => update({ sort: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Max bid */}
        <div className="flex items-center gap-2">
          <Input
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
        <div className="flex flex-wrap items-center gap-2">
          {q && (
            <Chip label={`"${q}"`} onRemove={() => update({ q: "" })} />
          )}
          {sort !== "ending_soon" && (
            <Chip label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort} onRemove={() => update({ sort: "" })} />
          )}
          {maxBid && (
            <Chip label={`Max bid $${maxBid}`} onRemove={() => update({ max_bid: "" })} />
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
      <button onClick={onRemove} className="hover:text-destructive transition-colors">
        <X size={12} />
      </button>
    </span>
  );
}
