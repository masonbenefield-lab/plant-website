import Link from "next/link";
import { Droplets, Leaf, FlowerIcon, Scissors } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const CARE_META: Record<string, { icon: React.ReactNode; color: string; bg: string }> = {
  Water:     { icon: <Droplets size={14} />,   color: "text-blue-700",   bg: "bg-blue-100" },
  Fertilize: { icon: <Leaf size={14} />,       color: "text-green-700",  bg: "bg-green-100" },
  Repot:     { icon: <FlowerIcon size={14} />, color: "text-amber-700",  bg: "bg-amber-100" },
  Prune:     { icon: <Scissors size={14} />,   color: "text-purple-700", bg: "bg-purple-100" },
};

interface CareItem {
  plantId: string;
  plantName: string;
  careType: string;
  daysSince: number;
  interval: number;
}

export function CareReminders({ items }: { items: CareItem[] }) {
  return (
    <Card className="mb-8 border-green-200 bg-green-50/60 dark:bg-green-950/20 dark:border-green-900">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm text-green-800 dark:text-green-300 flex items-center gap-2">
          🌿 Today&apos;s garden care
          <span className="ml-auto text-xs font-normal text-green-700/70">
            <Link href="/garden" className="hover:underline">View garden →</Link>
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
                      : <span className="text-green-700 font-medium"> · due today</span>}
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
