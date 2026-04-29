"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { X, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLANT_CATEGORIES } from "@/lib/categories";

const SORT_OPTIONS = [
  { value: "newest",     label: "Newest" },
  { value: "price_asc",  label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
];

export default function ShopFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const q        = params.get("q") ?? "";
  const sort     = params.get("sort") ?? "newest";
  const min      = params.get("min") ?? "";
  const max      = params.get("max") ?? "";
  const category = params.get("category") ?? "";
  const location = params.get("location") ?? "";
  const inStock  = params.get("in_stock") === "1";

  const hasFilters = q || sort !== "newest" || min || max || category || location || inStock;

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
          <label htmlFor="shop-search" className="sr-only">Search plants or varieties</label>
          <Input
            id="shop-search"
            placeholder="Search plants or varieties…"
            defaultValue={q}
            onChange={(e) => debounce(() => update({ q: e.target.value }))}
          />
        </div>

        {/* Sort */}
        <div>
          <label htmlFor="shop-sort" className="sr-only">Sort by</label>
          <select
            id="shop-sort"
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
          <label htmlFor="shop-category" className="sr-only">Filter by category</label>
          <select
            id="shop-category"
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

        {/* Price range */}
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Price range</legend>
          <label htmlFor="shop-min-price" className="sr-only">Minimum price</label>
          <Input
            id="shop-min-price"
            type="number"
            placeholder="Min $"
            min={0}
            defaultValue={min}
            className="w-24"
            onChange={(e) => debounce(() => update({ min: e.target.value }))}
          />
          <span className="text-muted-foreground text-sm" aria-hidden="true">–</span>
          <label htmlFor="shop-max-price" className="sr-only">Maximum price</label>
          <Input
            id="shop-max-price"
            type="number"
            placeholder="Max $"
            min={0}
            defaultValue={max}
            className="w-24"
            onChange={(e) => debounce(() => update({ max: e.target.value }))}
          />
        </fieldset>

        {/* Location */}
        <div className="relative">
          <label htmlFor="shop-location" className="sr-only">Filter by location</label>
          <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            id="shop-location"
            placeholder="Location (state, country…)"
            defaultValue={location}
            className="pl-8 w-44"
            onChange={(e) => debounce(() => update({ location: e.target.value }))}
          />
        </div>

        {/* In Stock toggle */}
        <button
          onClick={() => update({ in_stock: inStock ? "" : "1" })}
          className={cn(
            "h-10 px-4 rounded-md border text-sm font-medium transition-colors whitespace-nowrap",
            inStock
              ? "bg-green-700 text-white border-green-700"
              : "border-input bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
          )}
        >
          In Stock Only
        </button>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {q && (
            <Chip label={`"${q}"`} onRemove={() => update({ q: "" })} />
          )}
          {sort !== "newest" && (
            <Chip label={SORT_OPTIONS.find((o) => o.value === sort)?.label ?? sort} onRemove={() => update({ sort: "" })} />
          )}
          {min && (
            <Chip label={`Min $${min}`} onRemove={() => update({ min: "" })} />
          )}
          {max && (
            <Chip label={`Max $${max}`} onRemove={() => update({ max: "" })} />
          )}
          {category && (
            <Chip label={category} onRemove={() => update({ category: "" })} />
          )}
          {location && (
            <Chip label={`📍 ${location}`} onRemove={() => update({ location: "" })} />
          )}
          {inStock && (
            <Chip label="In Stock Only" onRemove={() => update({ in_stock: "" })} />
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
