"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Droplets, Leaf, Flower2, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";

const CARE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  Water:     { icon: <Droplets size={13} />,  color: "text-blue-700 dark:text-blue-400",   bg: "bg-blue-100 dark:bg-blue-900/30",   border: "border-blue-200 dark:border-blue-800" },
  Fertilize: { icon: <Leaf size={13} />,      color: "text-leaf",                          bg: "bg-[#DFE7D4] dark:bg-forest/30",    border: "border-[#C5D4BC] dark:border-forest" },
  Repot:     { icon: <Flower2 size={13} />,   color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30", border: "border-amber-200 dark:border-amber-800" },
  Prune:     { icon: <Scissors size={13} />,  color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
};

type CareEntry = {
  plantId: string;
  plantName: string;
  image: string | null;
  careType: string;
  eventKey: string;
  interval: number;
  lastDate: string | null;
  daysUntilDue: number;
};

type SimplePlant = { id: string; name: string; image: string | null };

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "text-red-600 dark:text-red-400" };
  if (days === 0) return { label: "Due today", color: "text-amber-600 dark:text-amber-400" };
  return { label: `In ${days}d`, color: "text-leaf" };
}

function QuickLogButton({ plantId, careType, onLogged }: { plantId: string; careType: string; onLogged: () => void }) {
  const [loading, setLoading] = useState(false);

  async function log() {
    setLoading(true);
    const res = await fetch("/api/garden/log-care", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, careType }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(`${careType} logged!`);
      onLogged();
    } else {
      toast.error("Failed to log care");
    }
  }

  return (
    <button
      onClick={log}
      disabled={loading}
      className="text-xs font-medium text-leaf hover:text-forest disabled:opacity-50 transition-colors whitespace-nowrap"
    >
      {loading ? "Logging…" : "Log ✓"}
    </button>
  );
}

function CareCard({ entry, onLogged }: { entry: CareEntry; onLogged: (plantId: string, careType: string) => void }) {
  const meta = CARE_META[entry.careType];
  const { label, color } = urgencyLabel(entry.daysUntilDue);
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
      <Link href={`/garden/${entry.plantId}`} className="shrink-0">
        {entry.image ? (
          <Image src={entry.image} alt={entry.plantName} width={44} height={44} className="rounded-lg object-cover border w-11 h-11" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-muted border flex items-center justify-center text-lg">🌿</div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/garden/${entry.plantId}`} className="text-sm font-medium hover:text-leaf transition-colors truncate block">
          {entry.plantName}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {entry.careType}
          </span>
          <span className={cn("text-xs font-medium", color)}>{label}</span>
        </div>
      </div>
      <QuickLogButton plantId={entry.plantId} careType={entry.careType} onLogged={() => onLogged(entry.plantId, entry.careType)} />
    </div>
  );
}

function Section({ title, entries, color, onLogged }: {
  title: string;
  entries: CareEntry[];
  color: string;
  onLogged: (plantId: string, careType: string) => void;
}) {
  if (!entries.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", color)} />
        <h2 className="font-semibold text-sm">{title}</h2>
        <span className="text-xs text-muted-foreground">({entries.length})</span>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => <CareCard key={`${e.plantId}-${e.careType}-${i}`} entry={e} onLogged={onLogged} />)}
      </div>
    </div>
  );
}

export function CareScheduleClient({
  entries: initialEntries,
  plantsWithoutSchedule,
  totalWithSchedule,
}: {
  entries: CareEntry[];
  plantsWithoutSchedule: SimplePlant[];
  totalWithSchedule: number;
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);

  function handleLogged(plantId: string, careType: string) {
    // Optimistically remove the logged entry from the list
    setEntries((prev) => prev.filter((e) => !(e.plantId === plantId && e.careType === careType)));
    // Refresh in background to get updated data
    router.refresh();
  }

  const overdue   = entries.filter((e) => e.daysUntilDue < 0).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const today     = entries.filter((e) => e.daysUntilDue === 0);
  const upcoming  = entries.filter((e) => e.daysUntilDue > 0 && e.daysUntilDue <= 7).sort((a, b) => a.daysUntilDue - b.daysUntilDue);
  const onSchedule = entries.filter((e) => e.daysUntilDue > 7).sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  const allClear = overdue.length === 0 && today.length === 0 && upcoming.length === 0;

  return (
    <div className="space-y-8">
      {totalWithSchedule === 0 && plantsWithoutSchedule.length > 0 && (
        <div className="text-center py-12 border rounded-xl bg-muted/30 space-y-3">
          <p className="text-3xl">📅</p>
          <p className="font-semibold">No care schedules set up yet</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Open any plant and set watering, fertilizing, repotting, or pruning intervals to track care here.
          </p>
          <Link href="/garden" className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors mt-2">
            Go to My Garden
          </Link>
        </div>
      )}

      {allClear && totalWithSchedule > 0 && (
        <div className="flex items-center gap-3 rounded-xl border bg-[#EBF0E6] dark:bg-forest/20 border-[#C5D4BC] dark:border-forest px-5 py-4">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold text-forest dark:text-sage text-sm">All caught up!</p>
            <p className="text-xs text-forest/70 dark:text-sage/70 mt-0.5">Nothing is due or overdue right now.</p>
          </div>
        </div>
      )}

      <Section
        title="Overdue"
        entries={overdue}
        color="bg-red-500"
        onLogged={(plantId, careType) => handleLogged(plantId, careType)}
      />
      <Section
        title="Due Today"
        entries={today}
        color="bg-amber-500"
        onLogged={(plantId, careType) => handleLogged(plantId, careType)}
      />
      <Section
        title="Upcoming — next 7 days"
        entries={upcoming}
        color="bg-leaf"
        onLogged={(plantId, careType) => handleLogged(plantId, careType)}
      />
      {onSchedule.length > 0 && (
        <Section
          title="On Schedule"
          entries={onSchedule}
          color="bg-muted-foreground"
          onLogged={(plantId, careType) => handleLogged(plantId, careType)}
        />
      )}

      {plantsWithoutSchedule.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-muted-foreground shrink-0" />
            <h2 className="font-semibold text-sm text-muted-foreground">No schedule set</h2>
            <span className="text-xs text-muted-foreground">({plantsWithoutSchedule.length})</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {plantsWithoutSchedule.map((p) => (
              <Link key={p.id} href={`/garden/${p.id}`} className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 hover:bg-muted/40 transition-colors">
                {p.image ? (
                  <Image src={p.image} alt={p.name} width={36} height={36} className="rounded-lg object-cover border w-9 h-9" />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center text-sm">🌿</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">Set up care intervals →</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
