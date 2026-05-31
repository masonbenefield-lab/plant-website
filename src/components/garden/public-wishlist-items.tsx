"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { SaveToWishlistButton } from "@/components/garden/save-to-wishlist-button";

type Priority = "nice" | "want" | "must";

const PRIORITY_LABEL: Record<Priority, string> = {
  nice: "Nice to have",
  want: "Want it",
  must: "Must have",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  nice: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  want: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  must: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
};

type WishlistItem = {
  id: string;
  name: string;
  variety: string | null;
  notes: string | null;
  priority: string;
};

export function PublicWishlistItems({
  items,
  showSave,
}: {
  items: WishlistItem[];
  showSave: boolean;
}) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="p-4 flex items-start gap-3">
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-semibold text-sm leading-tight">
                  {item.variety || item.name}
                </p>
                {item.variety && (
                  <p className="text-xs text-muted-foreground">{item.name}</p>
                )}
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full font-medium",
                    PRIORITY_COLOR[item.priority as Priority] ?? "bg-muted text-muted-foreground"
                  )}
                >
                  {PRIORITY_LABEL[item.priority as Priority] ?? item.priority}
                </span>
              </div>
              {item.notes && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.notes}
                </p>
              )}
            </div>
            {showSave && (
              <SaveToWishlistButton
                plantName={item.name}
                variety={item.variety}
              />
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
