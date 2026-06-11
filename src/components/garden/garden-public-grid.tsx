"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SaveToWishlistButton } from "@/components/garden/save-to-wishlist-button";

const STATUS_LABEL: Record<string, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const STATUS_COLOR: Record<string, string> = {
  thriving: "bg-[#DFE7D4] text-leaf",
  growing: "bg-emerald-100 text-emerald-700",
  dormant: "bg-yellow-100 text-yellow-700",
  struggling: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-500",
};

type Plant = {
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

type WishlistRef = { id: string; name: string; variety: string | null };

function findSavedId(refs: WishlistRef[], name: string, variety: string | null): string | null {
  return refs.find(
    (r) =>
      r.name.toLowerCase() === name.toLowerCase() &&
      (r.variety?.toLowerCase() ?? null) === (variety?.toLowerCase() ?? null)
  )?.id ?? null;
}

export function GardenPublicGrid({
  plants,
  username,
  currentUserId,
  ownerId,
  userWishlistItems,
}: {
  plants: Plant[];
  username: string;
  currentUserId?: string | null;
  ownerId?: string | null;
  userWishlistItems?: WishlistRef[];
}) {
  const showSave = !!(currentUserId && ownerId && currentUserId !== ownerId);
  const [q, setQ] = useState("");

  const filtered = q.trim()
    ? plants.filter((p) =>
        `${p.name} ${p.variety ?? ""}`.toLowerCase().includes(q.toLowerCase())
      )
    : plants;

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {plants.length > 0 && (
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search plants…"
            className="w-full pl-8 pr-8 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Empty state */}
      {plants.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-4xl">🪴</p>
            <p className="font-medium">No plants added yet</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No plants match &ldquo;{q}&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {filtered.map((plant) => (
            <div key={plant.id} className="relative">
              <Link href={`/gardens/${username}/${plant.id}`}>
              <Card className="overflow-hidden h-full hover:shadow-md transition-shadow group">
                <div className="aspect-square relative bg-muted">
                  {plant.images?.[0] ? (
                    <Image
                      src={plant.images[0]}
                      alt={plant.name}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl">🪴</div>
                  )}
                </div>
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold leading-tight">{plant.variety || plant.name}</p>
                  {plant.variety && (
                    <p className="text-sm text-muted-foreground leading-tight">{plant.name}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[plant.status] ?? "bg-muted text-muted-foreground")}>
                      {STATUS_LABEL[plant.status] ?? plant.status}
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
                    <p className="text-sm text-muted-foreground leading-snug line-clamp-2 pt-1 border-t">
                      {plant.public_notes}
                    </p>
                  )}
                </CardContent>
              </Card>
              </Link>
              {showSave && (
                <div className="absolute top-2 right-2 z-10">
                  <SaveToWishlistButton
                    plantName={plant.name}
                    variety={plant.variety}
                    initialSavedId={userWishlistItems ? findSavedId(userWishlistItems, plant.name, plant.variety) : null}
                    overlay
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
