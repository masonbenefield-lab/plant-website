"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition, useState, useEffect, useRef, Suspense } from "react";
import { X, MapPin, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PLANT_CATEGORIES } from "@/lib/categories";
import { POT_SIZES } from "@/lib/pot-sizes";
import PlantInfoCard from "@/components/plant-info-card";

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
  const [showGuide, setShowGuide] = useState(true);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("plant-guide-visible");
    if (stored === "false") setShowGuide(false);
  }, []);

  useEffect(() => {
    setSearchValue(params.get("q") ?? "");
  }, [params]);

  // Close suggestions when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function toggleGuide() {
    setShowGuide((v) => {
      localStorage.setItem("plant-guide-visible", String(!v));
      return !v;
    });
  }

  const q        = params.get("q") ?? "";
  const sort     = params.get("sort") ?? "newest";
  const min      = params.get("min") ?? "";
  const max      = params.get("max") ?? "";
  const category = params.get("category") ?? "";
  const location = params.get("location") ?? "";
  const inStock  = params.get("in_stock") === "1";
  const potSize  = params.get("pot_size") ?? "";

  const hasFilters = q || sort !== "newest" || min || max || category || location || inStock || potSize;

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

  async function fetchSuggestions(val: string) {
    if (val.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(val)}`);
    const data = await res.json() as string[];
    setSuggestions(data);
    setShowSuggestions(data.length > 0);
  }

  function selectSuggestion(s: string) {
    // If "Plant — Variety", search just by the plant name part
    const q = s.includes(" — ") ? s.split(" — ")[0] : s;
    setSearchValue(q);
    setSuggestions([]);
    setShowSuggestions(false);
    update({ q });
  }

  return (
    <div className="space-y-3 mb-6">
      {/* Filter row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search with autocomplete */}
        <div className="flex-1 min-w-[180px] relative" ref={searchRef}>
          <label htmlFor="shop-search" className="sr-only">Search plants or varieties</label>
          <Input
            id="shop-search"
            placeholder="Search plants or varieties…"
            value={searchValue}
            onChange={(e) => {
              const val = e.target.value;
              setSearchValue(val);
              debounce(() => {
                update({ q: val });
                fetchSuggestions(val);
              });
            }}
            onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
            autoComplete="off"
          />
          {showSuggestions && (
            <ul className="absolute z-50 top-full mt-1 left-0 right-0 bg-background border border-border rounded-md shadow-lg overflow-hidden">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
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

        {/* Pot size */}
        <div>
          <label htmlFor="shop-pot-size" className="sr-only">Filter by pot size</label>
          <select
            id="shop-pot-size"
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
          {potSize && (
            <Chip label={`Pot: ${potSize}`} onRemove={() => update({ pot_size: "" })} />
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
