"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { PLANT_CATEGORIES } from "@/lib/categories";

const SORT_OPTIONS = [
  { label: "Newest", value: "newest" },
  { label: "Price: Low to High", value: "price_asc" },
  { label: "Price: High to Low", value: "price_desc" },
];

function buildSearch(q: string, cat: string, sort: string, tab: string) {
  const params = new URLSearchParams();
  if (q.trim()) params.set("q", q.trim());
  if (cat) params.set("cat", cat);
  if (sort && sort !== "newest") params.set("sort", sort);
  if (tab && tab !== "all") params.set("tab", tab);
  return `/search?${params.toString()}`;
}

export default function SearchInput({
  initialQ,
  initialCat = "",
  initialSort = "newest",
  tab = "all",
}: {
  initialQ: string;
  initialCat?: string;
  initialSort?: string;
  tab?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [cat, setCat] = useState(initialCat);
  const [sort, setSort] = useState(initialSort);

  const navigate = useCallback(
    (newQ: string, newCat: string, newSort: string) => {
      router.push(buildSearch(newQ, newCat, newSort, tab));
    },
    [router, tab]
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    navigate(q, cat, sort);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-xl">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plant name, variety…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm border bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
            autoFocus
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 bg-green-700 hover:bg-green-800 text-white text-sm font-semibold rounded-lg transition-colors shrink-0"
        >
          Search
        </button>
      </form>

      {q.trim() && (
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={cat}
            onChange={(e) => { setCat(e.target.value); navigate(q, e.target.value, sort); }}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">All Categories</option>
            {PLANT_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={sort}
            onChange={(e) => { setSort(e.target.value); navigate(q, cat, e.target.value); }}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {(cat || sort !== "newest") && (
            <button
              onClick={() => { setCat(""); setSort("newest"); navigate(q, "", "newest"); }}
              className="text-xs text-muted-foreground hover:text-foreground hover:underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
