"use client";

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { centsToDisplay } from "@/lib/stripe";

type SizeListing = {
  id: string;
  pot_size: string | null;
  price_cents: number;
  quantity: number;
};

export default function SizePicker({
  siblings,
  currentId,
}: {
  siblings: SizeListing[];
  currentId: string;
}) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Size</p>
      <div className="flex flex-wrap gap-2">
        {siblings.map((s) => {
          const isSelected = s.id === currentId;
          return (
            <button
              key={s.id}
              onClick={() => { if (!isSelected) router.push(`/shop/${s.id}`); }}
              className={cn(
                "flex flex-col items-center px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                isSelected
                  ? "border-green-600 bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 dark:border-green-500"
                  : "border-border hover:border-green-400 hover:bg-muted"
              )}
            >
              <span>{s.pot_size ?? "No size"}</span>
              <span className={cn("text-xs font-normal mt-0.5", isSelected ? "text-green-600 dark:text-green-400" : "text-muted-foreground")}>
                {centsToDisplay(s.price_cents)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
