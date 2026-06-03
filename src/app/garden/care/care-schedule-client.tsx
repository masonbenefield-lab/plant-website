"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Droplets, Leaf, Flower2, Scissors, Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type PlantWithIntervals = {
  id: string;
  name: string;
  image: string | null;
  waterInterval: number | null;
  fertilizeInterval: number | null;
  repotInterval: number | null;
  pruneInterval: number | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CARE_META: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  Water:     { icon: <Droplets size={13} />, color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30",     border: "border-blue-200 dark:border-blue-800"    },
  Fertilize: { icon: <Leaf size={13} />,     color: "text-leaf",                            bg: "bg-[#DFE7D4] dark:bg-forest/30",      border: "border-[#C5D4BC] dark:border-forest"     },
  Repot:     { icon: <Flower2 size={13} />,  color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-900/30",   border: "border-amber-200 dark:border-amber-800"  },
  Prune:     { icon: <Scissors size={13} />, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
};

const INTERVAL_FIELDS = [
  { key: "waterInterval",     emoji: "💧", label: "Water every"     },
  { key: "fertilizeInterval", emoji: "🌿", label: "Fertilize every" },
  { key: "repotInterval",     emoji: "🪴", label: "Repot every"     },
  { key: "pruneInterval",     emoji: "✂️", label: "Prune every"     },
] as const;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0)  return { label: `${Math.abs(days)}d overdue`, color: "text-red-600 dark:text-red-400" };
  if (days === 0) return { label: "Due today",                  color: "text-amber-600 dark:text-amber-400" };
  if (days === 1) return { label: "Tomorrow",                   color: "text-leaf" };
  return { label: `In ${days}d`, color: "text-leaf" };
}

function sortAsc(entries: CareEntry[]): CareEntry[] {
  return [...entries].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

function getFieldMeta(values: (number | null)[]): { defaultValue: string; placeholder: string } {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return { defaultValue: "", placeholder: "Not set" };
  const unique = [...new Set(nonNull)].sort((a, b) => a - b);
  if (unique.length === 1 && nonNull.length === values.length) {
    return { defaultValue: String(unique[0]), placeholder: "" };
  }
  const parts = unique.map((v) => `${v}d`);
  if (nonNull.length < values.length) parts.push("not set");
  return { defaultValue: "", placeholder: `Currently: ${parts.join(", ")}` };
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

function WeekStrip({ entries }: { entries: CareEntry[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const count = entries.filter((e) => e.daysUntilDue === i).length;
    return {
      offset: i,
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateNum: date.getDate(),
      monthLabel: date.toLocaleDateString("en-US", { month: "short" }),
      count,
    };
  });

  const urgentCount = days[0].count; // today
  const weekTotal   = days.reduce((s, d) => s + d.count, 0);

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Week ahead</p>
        {weekTotal === 0 ? (
          <span className="text-xs text-leaf font-medium">All clear this week ✓</span>
        ) : (
          <span className="text-xs text-muted-foreground">{weekTotal} task{weekTotal !== 1 ? "s" : ""}</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map(({ offset, dayLabel, dateNum, monthLabel, count }) => {
          const isToday = offset === 0;
          return (
            <div
              key={offset}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 px-0.5",
                isToday && "bg-muted/60"
              )}
            >
              <span className={cn("text-[10px] font-medium", isToday ? "text-foreground" : "text-muted-foreground")}>
                {dayLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">{monthLabel} {dateNum}</span>
              {count > 0 ? (
                <span className={cn(
                  "text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center",
                  isToday && urgentCount > 0 ? "bg-amber-500 text-white" : "bg-leaf text-white"
                )}>
                  {count}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/30 leading-6">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Intervals Modal ──────────────────────────────────────────────────────────

function IntervalsModal({
  plants,
  onSaved,
}: {
  plants: PlantWithIntervals[];
  onSaved: () => void;
}) {
  const fields = INTERVAL_FIELDS.map(({ key, emoji, label }) => ({
    key,
    emoji,
    label,
    meta: getFieldMeta(plants.map((p) => p[key])),
  }));

  const todayStr = new Date().toISOString().split("T")[0];

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(({ key, meta }) => [key, meta.defaultValue]))
  );
  const [startDate, setStartDate] = useState(todayStr);
  const [saving, setSaving] = useState(false);
  const isBulk = plants.length > 1;

  function setValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  async function save() {
    const body: Record<string, unknown> = { plantIds: plants.map((p) => p.id) };
    for (const { key } of INTERVAL_FIELDS) {
      const raw = values[key].trim();
      if (raw !== "") {
        const n = parseInt(raw, 10);
        if (!isNaN(n) && n >= 1) body[key] = n;
      }
    }
    if (Object.keys(body).length === 1) {
      toast.info("No intervals entered");
      return;
    }
    if (startDate) body.startDate = startDate;
    setSaving(true);
    const res = await fetch("/api/garden/update-intervals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(isBulk ? `Intervals updated for ${plants.length} plants` : "Intervals updated");
      onSaved();
    } else {
      toast.error("Failed to save intervals");
    }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>
          {isBulk ? `Update intervals — ${plants.length} plants` : plants[0].name}
        </DialogTitle>
        {isBulk && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Fill in a field to apply it to all {plants.length} plants. Leave blank to keep each plant&apos;s current value.
          </p>
        )}
      </DialogHeader>

      {!isBulk && plants[0].image && (
        <Image
          src={plants[0].image}
          alt={plants[0].name}
          width={56}
          height={56}
          className="rounded-lg object-cover border w-14 h-14"
        />
      )}

      <div className="grid gap-3 py-1">
        {fields.map(({ key, emoji, label, meta }) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-36 shrink-0">{emoji} {label}</span>
            <Input
              type="number"
              min={1}
              value={values[key]}
              onChange={(e) => setValue(key, e.target.value)}
              placeholder={meta.placeholder || "—"}
              className="h-8 text-sm flex-1 min-w-0"
            />
            <span className="text-xs text-muted-foreground shrink-0">days</span>
          </div>
        ))}

        <div className="border-t pt-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-36 shrink-0">📅 Schedule from</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-8 text-sm flex-1 min-w-0"
            />
          </div>
          <p className="text-xs text-muted-foreground pl-[152px]">
            Intervals count from this date. Clear to leave the schedule open-ended.
          </p>
        </div>
      </div>

      <DialogFooter showCloseButton>
        <Button onClick={save} disabled={saving} className="bg-leaf hover:bg-forest text-white">
          {saving ? "Saving…" : "Save intervals"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Quick Log Button ─────────────────────────────────────────────────────────

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
      {loading ? "…" : "Log ✓"}
    </button>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

function SelectCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
        checked
          ? "bg-leaf border-leaf text-white"
          : "border-muted-foreground/40 hover:border-leaf bg-background"
      )}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  );
}

// ─── Care Card ────────────────────────────────────────────────────────────────

function CareCard({
  entry,
  selectionMode,
  selected,
  onToggle,
  onEdit,
  onLogged,
}: {
  entry: CareEntry;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLogged: (plantId: string, careType: string) => void;
}) {
  const meta = CARE_META[entry.careType];
  const { label, color } = urgencyLabel(entry.daysUntilDue);

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
      selected && "border-leaf/50 bg-leaf/5"
    )}>
      {(selectionMode || selected) && (
        <SelectCheckbox checked={selected} onToggle={onToggle} />
      )}
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
      <div className="flex items-center gap-2.5 shrink-0">
        <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit intervals">
          <Pencil size={13} />
        </button>
        <QuickLogButton
          plantId={entry.plantId}
          careType={entry.careType}
          onLogged={() => onLogged(entry.plantId, entry.careType)}
        />
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
  title,
  subtitle,
  entries,
  dotColor,
  selectionMode,
  selected,
  onToggle,
  onEdit,
  onLogged,
}: {
  title: string;
  subtitle?: string;
  entries: CareEntry[];
  dotColor: string;
  selectionMode: boolean;
  selected: Set<string>;
  onToggle: (plantId: string) => void;
  onEdit: (plantId: string) => void;
  onLogged: (plantId: string, careType: string) => void;
}) {
  if (!entries.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <h2 className="font-semibold text-sm">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        <span className="text-xs text-muted-foreground ml-auto">({entries.length})</span>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => (
          <CareCard
            key={`${e.plantId}-${e.careType}-${i}`}
            entry={e}
            selectionMode={selectionMode}
            selected={selected.has(e.plantId)}
            onToggle={() => onToggle(e.plantId)}
            onEdit={() => onEdit(e.plantId)}
            onLogged={onLogged}
          />
        ))}
      </div>
    </div>
  );
}

// ─── No Schedule Card ─────────────────────────────────────────────────────────

function NoScheduleCard({
  plant,
  selectionMode,
  selected,
  onToggle,
  onEdit,
}: {
  plant: SimplePlant;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors",
      selected && "border-leaf/50 bg-leaf/5"
    )}>
      {(selectionMode || selected) && (
        <SelectCheckbox checked={selected} onToggle={onToggle} />
      )}
      <Link href={`/garden/${plant.id}`} className="shrink-0">
        {plant.image ? (
          <Image src={plant.image} alt={plant.name} width={36} height={36} className="rounded-lg object-cover border w-9 h-9" />
        ) : (
          <div className="w-9 h-9 rounded-lg bg-muted border flex items-center justify-center text-sm">🌿</div>
        )}
      </Link>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{plant.name}</p>
        <p className="text-xs text-muted-foreground">No care schedule set</p>
      </div>
      <button
        onClick={onEdit}
        className="flex items-center gap-1 text-xs font-medium text-leaf hover:text-forest transition-colors whitespace-nowrap shrink-0"
      >
        <Pencil size={12} />
        Set up
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CareScheduleClient({
  entries: initialEntries,
  plantsWithoutSchedule,
  totalWithSchedule,
  plantIntervals,
}: {
  entries: CareEntry[];
  plantsWithoutSchedule: SimplePlant[];
  totalWithSchedule: number;
  plantIntervals: PlantWithIntervals[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editPlantIds, setEditPlantIds] = useState<string[] | null>(null);

  const intervalMap = Object.fromEntries(plantIntervals.map((p) => [p.id, p]));
  const editPlants = editPlantIds
    ? (editPlantIds.map((id) => intervalMap[id]).filter(Boolean) as PlantWithIntervals[])
    : [];

  // Date range labels
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeLabel = (a: number, b: number) =>
    `${fmtShort(addDays(today, a))} – ${fmtShort(addDays(today, b))}`;

  // Entry buckets
  const overdue          = sortAsc(entries.filter((e) => e.daysUntilDue < 0));
  const dueToday         = entries.filter((e) => e.daysUntilDue === 0);
  const thisWeek         = sortAsc(entries.filter((e) => e.daysUntilDue >= 1  && e.daysUntilDue <= 7));
  const nextWeek         = sortAsc(entries.filter((e) => e.daysUntilDue >= 8  && e.daysUntilDue <= 14));
  const laterThisMonth   = sortAsc(entries.filter((e) => e.daysUntilDue >= 15 && e.daysUntilDue <= 30));
  const furtherOut       = sortAsc(entries.filter((e) => e.daysUntilDue > 30));

  const hasAnyPlants = totalWithSchedule > 0 || plantsWithoutSchedule.length > 0;

  function handleLogged(plantId: string, careType: string) {
    setEntries((prev) => prev.filter((e) => !(e.plantId === plantId && e.careType === careType)));
    router.refresh();
  }

  function toggleSelect(plantId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  function handleSaved() {
    setEditPlantIds(null);
    exitSelectionMode();
    router.refresh();
  }

  const sharedSectionProps = {
    selectionMode,
    selected,
    onToggle: toggleSelect,
    onEdit: (id: string) => setEditPlantIds([id]),
    onLogged: handleLogged,
  };

  return (
    <>
      <div className={cn("space-y-8", selected.size > 0 && "pb-20")}>

        {/* Select plants toggle */}
        {hasAnyPlants && (
          <div className="flex justify-end -mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
            >
              {selectionMode ? "Cancel" : "Select plants"}
            </Button>
          </div>
        )}

        {/* Week strip — always shown when plants have schedules */}
        {totalWithSchedule > 0 && (
          <WeekStrip entries={entries} />
        )}

        {/* No schedules at all — prompt */}
        {totalWithSchedule === 0 && plantsWithoutSchedule.length > 0 && (
          <div className="rounded-xl border bg-muted/30 px-5 py-6 space-y-1.5">
            <p className="font-semibold text-sm">Set up care schedules</p>
            <p className="text-sm text-muted-foreground">
              Select plants below and click{" "}
              <span className="font-medium text-foreground">Update intervals</span> to set watering,
              fertilizing, repotting, or pruning schedules — or click{" "}
              <span className="font-medium text-foreground">Set up</span> on any plant individually.
            </p>
          </div>
        )}

        {/* Overdue */}
        <Section title="Overdue" dotColor="bg-red-500" entries={overdue} {...sharedSectionProps} />

        {/* Due Today */}
        <Section title="Due Today" dotColor="bg-amber-500" entries={dueToday} {...sharedSectionProps} />

        {/* This week */}
        <Section
          title="This Week"
          subtitle={rangeLabel(1, 7)}
          dotColor="bg-leaf"
          entries={thisWeek}
          {...sharedSectionProps}
        />

        {/* Next week */}
        <Section
          title="Next Week"
          subtitle={rangeLabel(8, 14)}
          dotColor="bg-teal-500"
          entries={nextWeek}
          {...sharedSectionProps}
        />

        {/* Later this month */}
        <Section
          title="This Month"
          subtitle={rangeLabel(15, 30)}
          dotColor="bg-violet-400"
          entries={laterThisMonth}
          {...sharedSectionProps}
        />

        {/* Further out */}
        <Section
          title="Further Out"
          subtitle={`after ${fmtShort(addDays(today, 30))}`}
          dotColor="bg-muted-foreground"
          entries={furtherOut}
          {...sharedSectionProps}
        />

        {/* Plants without any schedule */}
        {plantsWithoutSchedule.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-muted-foreground/40 shrink-0" />
              <h2 className="font-semibold text-sm text-muted-foreground">No schedule set</h2>
              <span className="text-xs text-muted-foreground ml-auto">({plantsWithoutSchedule.length})</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {plantsWithoutSchedule.map((p) => (
                <NoScheduleCard
                  key={p.id}
                  plant={p}
                  selectionMode={selectionMode}
                  selected={selected.has(p.id)}
                  onToggle={() => toggleSelect(p.id)}
                  onEdit={() => setEditPlantIds([p.id])}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty garden */}
        {!hasAnyPlants && (
          <div className="text-center py-20 border rounded-xl bg-muted/30">
            <p className="text-4xl mb-3">🌱</p>
            <p className="font-semibold mb-1">No plants yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Add plants to your garden to set up care schedules.
            </p>
            <Link
              href="/garden/new"
              className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors"
            >
              Add your first plant
            </Link>
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {selected.size} plant{selected.size !== 1 ? "s" : ""} selected
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exitSelectionMode}>
              Clear
            </Button>
            <Button
              size="sm"
              className="bg-leaf hover:bg-forest text-white"
              onClick={() => setEditPlantIds([...selected])}
            >
              Update intervals
            </Button>
          </div>
        </div>
      )}

      {/* Intervals modal */}
      <Dialog
        open={editPlantIds !== null}
        onOpenChange={(open: boolean) => { if (!open) setEditPlantIds(null); }}
      >
        {editPlants.length > 0 && (
          <IntervalsModal plants={editPlants} onSaved={handleSaved} />
        )}
      </Dialog>
    </>
  );
}
