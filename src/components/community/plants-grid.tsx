"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Leaf } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PlantEntry {
  name: string;
  count: number;
}

export function CommunityPlantsGrid({ plants }: { plants: PlantEntry[] }) {
  const [query, setQuery] = useState("");

  const filtered = query
    ? plants.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()))
    : plants;

  if (plants.length === 0) {
    return (
      <div className="text-center py-20 border rounded-xl bg-muted/30">
        <p className="text-4xl mb-4">🌿</p>
        <p className="font-semibold mb-1">No plant discussions yet</p>
        <p className="text-sm text-muted-foreground mb-5">
          Tag your next post with a plant to start building the plant directory.
        </p>
        <Link href="/community/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
          Create a post
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="relative mb-6">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plants..."
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-10">
          No plants match &ldquo;{query}&rdquo;
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((plant) => (
            <Link
              key={plant.name}
              href={`/community?view=plants&plant=${encodeURIComponent(plant.name)}`}
              className="group rounded-xl border bg-card p-4 hover:shadow-md hover:border-sage transition-all"
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#DFE7D4] text-leaf">
                  <Leaf size={13} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate leading-snug group-hover:text-leaf transition-colors">
                    {plant.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {plant.count} {plant.count === 1 ? "post" : "posts"}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
