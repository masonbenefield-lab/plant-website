"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";
import { X } from "lucide-react";
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

  const hasFilters = q || sort !== "newest" || min || max || category;

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
            placeholder="Search plants or varieties…"
            defaultValue={q}
            onChange={(e) => debounce(() => update({ q: e.target.value, }))}
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

        {/* Category */}
        <select
          value={category}
          onChange={(e) => update({ category: e.target.value })}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Categories</option>
          {PLANT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Price range */}
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Min $"
            min={0}
            defaultValue={min}
            className="w-24"
            onChange={(e) => debounce(() => update({ min: e.target.value }))}
          />
          <span className="text-muted-foreground text-sm">–</span>
          <Input
            type="number"
            placeholder="Max $"
            min={0}
            defaultValue={max}
            className="w-24"
            onChange={(e) => debounce(() => update({ max: e.target.value }))}
          />
        </div>
      </div>

      {/* Active filter chips */}
      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
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
