"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Droplets, Leaf, FlowerIcon, Scissors, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CARE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Water:     { icon: <Droplets size={14} />,   color: "text-blue-700",   bg: "bg-blue-100" },
  Fertilize: { icon: <Leaf size={14} />,       color: "text-leaf",  bg: "bg-[#DFE7D4]" },
  Repot:     { icon: <FlowerIcon size={14} />, color: "text-amber-700",  bg: "bg-amber-100" },
  Prune:     { icon: <Scissors size={14} />,   color: "text-purple-700", bg: "bg-purple-100" },
};

const STORAGE_KEY = "care_reminders_dismissed";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

interface CareItem {
  plantId: string;
  plantName: string;
  careType: string;
  daysSince: number;
  interval: number;
}

export function CareReminders({ items }: { items: CareItem[] }) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(STORAGE_KEY) === todayKey());
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, todayKey());
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <Card className="mb-8 border-[#C5D4BC] bg-[#EBF0E6]/60 dark:bg-forest/20 dark:border-forest">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-forest dark:text-[#A8BF9A] flex items-center gap-2">
          🌿 Today&apos;s garden care
          <span className="ml-auto flex items-center gap-3 text-xs font-normal">
            <Link href="/garden" className="text-leaf/70 hover:underline">View garden →</Link>
            <button
              onClick={dismiss}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
              title="Hide for today"
            >
              <X size={13} />
              Hide for today
            </button>
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {items.map((item, i) => {
          const meta = CARE_META[item.careType] ?? CARE_META.Water;
          const overdueDays = item.daysSince - item.interval;
          return (
            <Link key={i} href={`/garden/${item.plantId}`}>
              <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 hover:bg-muted/40 transition-colors">
                <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", meta.bg, meta.color)}>
                  {meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{item.plantName}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.careType}
                    {overdueDays > 0
                      ? <span className="text-orange-600 font-medium"> · {overdueDays}d overdue</span>
                      : <span className="text-leaf font-medium"> · due today</span>}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}
