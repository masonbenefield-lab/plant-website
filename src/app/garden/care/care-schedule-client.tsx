"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Droplets, Leaf, Flower2, Scissors, Pencil, Check, ChevronDown,
  StickyNote, Plus, Search, X, Syringe, Wheat,
} from "lucide-react";
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

export type ReminderEntry = {
  id: string;
  plantId: string | null;
  plantName: string | null;
  image: string | null;
  eventType: string;
  scheduledDate: string;
  notes: string | null;
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
  Water:     { icon: <Droplets size={13} />,  color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30",     border: "border-blue-200 dark:border-blue-800"    },
  Fertilize: { icon: <Leaf size={13} />,      color: "text-leaf",                            bg: "bg-[#DFE7D4] dark:bg-forest/30",      border: "border-[#C5D4BC] dark:border-forest"     },
  Repot:     { icon: <Flower2 size={13} />,   color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-900/30",   border: "border-amber-200 dark:border-amber-800"  },
  Prune:     { icon: <Scissors size={13} />,  color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
  Note:      { icon: <StickyNote size={13} />,color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-100 dark:bg-orange-900/30", border: "border-orange-200 dark:border-orange-800" },
  Treated:   { icon: <Syringe size={13} />,   color: "text-pink-700 dark:text-pink-400",     bg: "bg-pink-100 dark:bg-pink-900/30",     border: "border-pink-200 dark:border-pink-800"    },
  Harvested: { icon: <Wheat size={13} />,     color: "text-yellow-700 dark:text-yellow-500", bg: "bg-yellow-100 dark:bg-yellow-900/30", border: "border-yellow-200 dark:border-yellow-800" },
};

const EVENT_TYPE_TO_DISPLAY: Record<string, string> = {
  watered: "Water", fertilized: "Fertilize", repotted: "Repot",
  pruned: "Prune", note: "Note", treated: "Treated", harvested: "Harvested",
};
const DISPLAY_TO_EVENT_TYPE: Record<string, string> = {
  Water: "watered", Fertilize: "fertilized", Repot: "repotted",
  Prune: "pruned", Note: "note", Treated: "treated", Harvested: "harvested",
};

const REMINDER_TYPES = ["Water", "Fertilize", "Repot", "Prune", "Treated", "Harvested", "Note"] as const;

const INTERVAL_FIELDS = [
  { key: "waterInterval",     emoji: "💧", label: "Water every"     },
  { key: "fertilizeInterval", emoji: "🌿", label: "Fertilize every" },
  { key: "repotInterval",     emoji: "🪴", label: "Repot every"     },
  { key: "pruneInterval",     emoji: "✂️", label: "Prune every"     },
] as const;

const INTERVAL_DISPLAY = [
  { key: "waterInterval",     emoji: "💧" },
  { key: "fertilizeInterval", emoji: "🌿" },
  { key: "repotInterval",     emoji: "🪴" },
  { key: "pruneInterval",     emoji: "✂️" },
] as const;

// ─── Date helpers ─────────────────────────────────────────────────────────────

function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}

function fmtShort(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function todayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function sortRemindersAsc(reminders: ReminderEntry[]): ReminderEntry[] {
  return [...reminders].sort((a, b) => a.daysUntilDue - b.daysUntilDue);
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

function getStripDays(daysUntilDue: number, interval: number): Set<number> {
  const days = new Set<number>();
  let d = daysUntilDue;
  if (d < 0) d += Math.ceil(Math.abs(d) / interval) * interval;
  while (d <= 6) { days.add(d); d += interval; }
  return days;
}

function reminderDisplayType(eventType: string): string {
  return EVENT_TYPE_TO_DISPLAY[eventType] ?? eventType;
}

function reminderMeta(eventType: string) {
  const display = reminderDisplayType(eventType);
  return CARE_META[display] ?? CARE_META["Note"];
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function SelectCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={cn(
        "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
        checked ? "bg-leaf border-leaf text-white" : "border-muted-foreground/40 hover:border-leaf bg-background"
      )}
    >
      {checked && <Check size={11} strokeWidth={3} />}
    </button>
  );
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
    if (res.ok) { toast.success(`${careType} logged!`); onLogged(); }
    else toast.error("Failed to log care");
  }
  return (
    <button onClick={log} disabled={loading} className="text-xs font-medium text-leaf hover:text-forest disabled:opacity-50 transition-colors whitespace-nowrap">
      {loading ? "…" : "Log ✓"}
    </button>
  );
}

function CompleteReminderButton({ reminderId, onCompleted }: { reminderId: string; onCompleted: () => void }) {
  const [loading, setLoading] = useState(false);
  async function complete() {
    setLoading(true);
    const res = await fetch(`/api/garden/reminders/${reminderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    setLoading(false);
    if (res.ok) { toast.success("Reminder done!"); onCompleted(); }
    else toast.error("Failed to complete reminder");
  }
  return (
    <button onClick={complete} disabled={loading} className="text-xs font-medium text-leaf hover:text-forest disabled:opacity-50 transition-colors whitespace-nowrap">
      {loading ? "…" : "Done ✓"}
    </button>
  );
}

// ─── Intervals Modal ──────────────────────────────────────────────────────────

function IntervalsModal({
  plants, onSaved, onReminderAdded,
}: {
  plants: PlantWithIntervals[];
  onSaved: () => void;
  onReminderAdded: (reminder: ReminderEntry) => void;
}) {
  const [modalTab, setModalTab] = useState<"intervals" | "onetime">("intervals");
  const fields = INTERVAL_FIELDS.map(({ key, emoji, label }) => ({
    key, emoji, label, meta: getFieldMeta(plants.map((p) => p[key])),
  }));
  const isBulk = plants.length > 1;
  const singlePlant = !isBulk ? plants[0] : null;

  // Intervals tab state
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(({ key, meta }) => [key, meta.defaultValue]))
  );
  const [startDate, setStartDate] = useState(todayStr());
  const [saving, setSaving] = useState(false);

  // One-time tab state
  const [reminderType, setReminderType] = useState<string>("Water");
  const [reminderDate, setReminderDate] = useState(todayStr());
  const [reminderNotes, setReminderNotes] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  async function saveIntervals() {
    const body: Record<string, unknown> = { plantIds: plants.map((p) => p.id) };
    for (const { key } of INTERVAL_FIELDS) {
      const raw = values[key].trim();
      if (raw !== "") { const n = parseInt(raw, 10); if (!isNaN(n) && n >= 1) body[key] = n; }
    }
    if (Object.keys(body).length === 1) { toast.info("No intervals entered"); return; }
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
    } else { toast.error("Failed to save intervals"); }
  }

  async function saveReminder() {
    if (!reminderDate) { toast.info("Please pick a date"); return; }
    setSavingReminder(true);
    const res = await fetch("/api/garden/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantId: singlePlant?.id ?? null,
        eventType: DISPLAY_TO_EVENT_TYPE[reminderType] ?? "note",
        scheduledDate: reminderDate,
        notes: reminderNotes.trim() || null,
      }),
    });
    setSavingReminder(false);
    if (res.ok) {
      const { reminder } = await res.json() as { reminder: { id: string; plant_id: string | null; event_type: string; scheduled_date: string; notes: string | null } };
      const scheduled = new Date(reminder.scheduled_date + "T00:00:00");
      scheduled.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((scheduled.getTime() - today.getTime()) / 86400000);
      onReminderAdded({
        id: reminder.id,
        plantId: reminder.plant_id ?? null,
        plantName: singlePlant?.name ?? null,
        image: singlePlant?.image ?? null,
        eventType: reminder.event_type,
        scheduledDate: reminder.scheduled_date,
        notes: reminder.notes,
        daysUntilDue,
      });
      toast.success("Reminder added!");
      setReminderNotes("");
      setReminderDate(todayStr());
    } else { toast.error("Failed to add reminder"); }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{isBulk ? `Update intervals — ${plants.length} plants` : plants[0].name}</DialogTitle>
      </DialogHeader>
      {!isBulk && plants[0].image && (
        <Image src={plants[0].image} alt={plants[0].name} width={56} height={56} className="rounded-lg object-cover border w-14 h-14" />
      )}

      {/* Modal tabs */}
      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md w-fit">
        {(["intervals", "onetime"] as const).map((t) => (
          <button key={t} onClick={() => setModalTab(t)}
            className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
              modalTab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}>
            {t === "intervals" ? "Recurring" : "One-time"}
          </button>
        ))}
      </div>

      {modalTab === "intervals" && (
        <>
          {isBulk && (
            <p className="text-xs text-muted-foreground -mt-1">
              Fill in a field to apply it to all {plants.length} plants. Leave blank to keep each plant&apos;s current value.
            </p>
          )}
          <div className="grid gap-3 py-1">
            {fields.map(({ key, emoji, label, meta }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-36 shrink-0">{emoji} {label}</span>
                <Input type="number" min={1} value={values[key]} onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={meta.placeholder || "—"} className="h-8 text-sm flex-1 min-w-0" />
                <span className="text-xs text-muted-foreground shrink-0">days</span>
              </div>
            ))}
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-36 shrink-0">📅 Schedule from</span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
              </div>
              <p className="text-xs text-muted-foreground pl-[152px]">
                Intervals count from this date. Clear to leave open-ended.
              </p>
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={saveIntervals} disabled={saving} className="bg-leaf hover:bg-forest text-white">
              {saving ? "Saving…" : "Save intervals"}
            </Button>
          </DialogFooter>
        </>
      )}

      {modalTab === "onetime" && (
        <>
          <div className="grid gap-3 py-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-28 shrink-0">Task type</span>
              <select
                value={reminderType}
                onChange={(e) => setReminderType(e.target.value)}
                className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2"
              >
                {REMINDER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-28 shrink-0">📅 Date</span>
              <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Notes</span>
              <textarea
                value={reminderNotes}
                onChange={(e) => setReminderNotes(e.target.value)}
                placeholder={reminderType === "Note" ? "What do you want to remember?" : "Optional notes…"}
                rows={3}
                className="text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={saveReminder} disabled={savingReminder} className="bg-leaf hover:bg-forest text-white">
              {savingReminder ? "Adding…" : "Add reminder"}
            </Button>
          </DialogFooter>
        </>
      )}
    </DialogContent>
  );
}

// ─── Standalone reminder creation modal (garden-level, no plant) ──────────────

function AddReminderModal({
  plants,
  onAdded,
  onClose,
}: {
  plants: PlantWithIntervals[];
  onAdded: (reminder: ReminderEntry) => void;
  onClose: () => void;
}) {
  const [reminderType, setReminderType] = useState("Note");
  const [reminderDate, setReminderDate] = useState(todayStr());
  const [reminderNotes, setReminderNotes] = useState("");
  const [selectedPlantId, setSelectedPlantId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!reminderDate) { toast.info("Please pick a date"); return; }
    setSaving(true);
    const plantId = selectedPlantId || null;
    const res = await fetch("/api/garden/reminders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantId,
        eventType: DISPLAY_TO_EVENT_TYPE[reminderType] ?? "note",
        scheduledDate: reminderDate,
        notes: reminderNotes.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { reminder } = await res.json() as { reminder: { id: string; plant_id: string | null; event_type: string; scheduled_date: string; notes: string | null } };
      const plant = plants.find((p) => p.id === reminder.plant_id);
      const scheduled = new Date(reminder.scheduled_date + "T00:00:00");
      scheduled.setHours(0, 0, 0, 0);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((scheduled.getTime() - today.getTime()) / 86400000);
      onAdded({
        id: reminder.id,
        plantId: reminder.plant_id ?? null,
        plantName: plant?.name ?? null,
        image: plant?.image ?? null,
        eventType: reminder.event_type,
        scheduledDate: reminder.scheduled_date,
        notes: reminder.notes,
        daysUntilDue,
      });
      toast.success("Reminder added!");
      onClose();
    } else { toast.error("Failed to add reminder"); }
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Add reminder</DialogTitle>
      </DialogHeader>
      <div className="grid gap-3 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">Task type</span>
          <select
            value={reminderType}
            onChange={(e) => setReminderType(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2"
          >
            {REMINDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">📅 Date</span>
          <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">Plant</span>
          <select
            value={selectedPlantId}
            onChange={(e) => setSelectedPlantId(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2"
          >
            <option value="">No specific plant</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Notes</span>
          <textarea
            value={reminderNotes}
            onChange={(e) => setReminderNotes(e.target.value)}
            placeholder={reminderType === "Note" ? "What do you want to remember?" : "Optional notes…"}
            rows={3}
            className="text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      <DialogFooter showCloseButton>
        <Button onClick={save} disabled={saving} className="bg-leaf hover:bg-forest text-white">
          {saving ? "Adding…" : "Add reminder"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ─── Week Strip ───────────────────────────────────────────────────────────────

function DayEntryRow({ entry, dayOffset, onLogged }: { entry: CareEntry; dayOffset: number; onLogged: () => void }) {
  const meta = CARE_META[entry.careType];
  const { label, color } = dayOffset === 0 ? urgencyLabel(entry.daysUntilDue) : urgencyLabel(dayOffset);
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
      <Link href={`/garden/${entry.plantId}`} className="shrink-0">
        {entry.image
          ? <Image src={entry.image} alt={entry.plantName} width={36} height={36} className="rounded-md object-cover border w-9 h-9" />
          : <div className="w-9 h-9 rounded-md bg-muted border flex items-center justify-center text-sm">🌿</div>
        }
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/garden/${entry.plantId}`} className="text-xs font-medium hover:text-leaf transition-colors truncate block">{entry.plantName}</Link>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {entry.careType}
          </span>
          <span className={cn("text-[11px] font-medium", color)}>{label}</span>
        </div>
      </div>
      <QuickLogButton plantId={entry.plantId} careType={entry.careType} onLogged={onLogged} />
    </div>
  );
}

function DayReminderRow({ reminder, onCompleted }: { reminder: ReminderEntry; onCompleted: () => void }) {
  const meta = reminderMeta(reminder.eventType);
  const displayType = reminderDisplayType(reminder.eventType);
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2">
      {reminder.plantId ? (
        <Link href={`/garden/${reminder.plantId}`} className="shrink-0">
          {reminder.image
            ? <Image src={reminder.image} alt={reminder.plantName ?? ""} width={36} height={36} className="rounded-md object-cover border w-9 h-9" />
            : <div className="w-9 h-9 rounded-md bg-muted border flex items-center justify-center text-sm">🌿</div>
          }
        </Link>
      ) : (
        <div className="w-9 h-9 rounded-md bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-sm shrink-0">📝</div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate block">
          {reminder.plantName ?? "Garden note"}
        </span>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {displayType}
          </span>
          {reminder.notes && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{reminder.notes}</span>
          )}
        </div>
      </div>
      <CompleteReminderButton reminderId={reminder.id} onCompleted={onCompleted} />
    </div>
  );
}

function WeekStrip({
  entries, reminders, onLogged, onReminderCompleted,
}: {
  entries: CareEntry[];
  reminders: ReminderEntry[];
  onLogged: (plantId: string, careType: string) => void;
  onReminderCompleted: (id: string) => void;
}) {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const careCount = entries.reduce((sum, e) => sum + (getStripDays(e.daysUntilDue, e.interval).has(i) ? 1 : 0), 0);
    const reminderCount = reminders.filter((r) => r.daysUntilDue === i).length;
    return {
      offset: i,
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateNum: date.getDate(),
      monthLabel: date.toLocaleDateString("en-US", { month: "short" }),
      count: careCount + reminderCount,
    };
  });

  const weekTotal = days.reduce((s, d) => s + d.count, 0);
  const dayEntries = selectedDay !== null
    ? entries.filter((e) => getStripDays(e.daysUntilDue, e.interval).has(selectedDay))
    : [];
  const dayReminders = selectedDay !== null
    ? reminders.filter((r) => r.daysUntilDue === selectedDay)
    : [];

  function dayHeading(offset: number, dayLabel: string, monthLabel: string, dateNum: number) {
    if (offset === 0) return "Today";
    if (offset === 1) return "Tomorrow";
    return `${dayLabel}, ${monthLabel} ${dateNum}`;
  }

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Week ahead</p>
        {weekTotal === 0
          ? <span className="text-xs text-leaf font-medium">All clear this week ✓</span>
          : <span className="text-xs text-muted-foreground">{weekTotal} task{weekTotal !== 1 ? "s" : ""}</span>
        }
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map(({ offset, dayLabel, dateNum, monthLabel, count }) => {
          const isToday    = offset === 0;
          const isSelected = selectedDay === offset;
          const clickable  = count > 0;
          return (
            <button
              key={offset}
              onClick={() => clickable ? setSelectedDay(isSelected ? null : offset) : undefined}
              disabled={!clickable}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 px-0.5 transition-colors",
                isToday && !isSelected && "bg-muted/60",
                isSelected && "bg-leaf/10 ring-1 ring-leaf/40",
                clickable && !isSelected && "hover:bg-muted/40 cursor-pointer",
                !clickable && "cursor-default opacity-60"
              )}
            >
              <span className={cn("text-[10px] font-medium", isToday || isSelected ? "text-foreground" : "text-muted-foreground")}>
                {dayLabel}
              </span>
              <span className="text-[11px] text-muted-foreground">{monthLabel} {dateNum}</span>
              {count > 0 ? (
                <span className={cn(
                  "text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center",
                  isSelected ? "bg-leaf text-white" : isToday ? "bg-amber-500 text-white" : "bg-leaf text-white"
                )}>
                  {count}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/30 leading-6">—</span>
              )}
              {clickable && (
                <ChevronDown size={10} className={cn("text-muted-foreground/50 transition-transform", isSelected && "rotate-180")} />
              )}
            </button>
          );
        })}
      </div>

      {selectedDay !== null && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            {dayHeading(selectedDay, days[selectedDay].dayLabel, days[selectedDay].monthLabel, days[selectedDay].dateNum)}
            <span className="font-normal ml-1">· {dayEntries.length + dayReminders.length} task{dayEntries.length + dayReminders.length !== 1 ? "s" : ""}</span>
          </p>
          {(dayEntries.length > 0 || dayReminders.length > 0) ? (
            <div className="space-y-1.5">
              {dayEntries.map((e, i) => (
                <DayEntryRow key={`${e.plantId}-${e.careType}-${i}`} entry={e} dayOffset={selectedDay}
                  onLogged={() => onLogged(e.plantId, e.careType)} />
              ))}
              {dayReminders.map((r) => (
                <DayReminderRow key={r.id} reminder={r} onCompleted={() => onReminderCompleted(r.id)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-leaf">All done for this day ✓</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Care Card (Week Ahead sections) ─────────────────────────────────────────

function CareCard({ entry, taskKey, selectionMode, selected, onToggle, onEdit, onLogged }: {
  entry: CareEntry;
  taskKey: string;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onLogged: (plantId: string, careType: string) => void;
}) {
  const meta = CARE_META[entry.careType];
  const { label, color } = urgencyLabel(entry.daysUntilDue);
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors", selected && "border-leaf/50 bg-leaf/5")}>
      {selectionMode && <SelectCheckbox checked={selected} onToggle={onToggle} />}
      <Link href={`/garden/${entry.plantId}`} className="shrink-0">
        {entry.image
          ? <Image src={entry.image} alt={entry.plantName} width={44} height={44} className="rounded-lg object-cover border w-11 h-11" />
          : <div className="w-11 h-11 rounded-lg bg-muted border flex items-center justify-center text-lg">🌿</div>
        }
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/garden/${entry.plantId}`} className="text-sm font-medium hover:text-leaf transition-colors truncate block">{entry.plantName}</Link>
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
        <QuickLogButton plantId={entry.plantId} careType={entry.careType} onLogged={() => onLogged(entry.plantId, entry.careType)} />
      </div>
    </div>
  );
}

function ReminderCard({ reminder, selectionMode, selected, onToggle, onCompleted }: {
  reminder: ReminderEntry;
  selectionMode: boolean;
  selected: boolean;
  onToggle: () => void;
  onCompleted: () => void;
}) {
  const meta = reminderMeta(reminder.eventType);
  const displayType = reminderDisplayType(reminder.eventType);
  const { label, color } = urgencyLabel(reminder.daysUntilDue);
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors", selected && "border-leaf/50 bg-leaf/5")}>
      {selectionMode && <SelectCheckbox checked={selected} onToggle={onToggle} />}
      {reminder.plantId ? (
        <Link href={`/garden/${reminder.plantId}`} className="shrink-0">
          {reminder.image
            ? <Image src={reminder.image} alt={reminder.plantName ?? ""} width={44} height={44} className="rounded-lg object-cover border w-11 h-11" />
            : <div className="w-11 h-11 rounded-lg bg-muted border flex items-center justify-center text-lg">🌿</div>
          }
        </Link>
      ) : (
        <div className="w-11 h-11 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 flex items-center justify-center text-lg shrink-0">📝</div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate block">{reminder.plantName ?? "Garden note"}</span>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={cn("flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {displayType}
          </span>
          <span className={cn("text-xs font-medium", color)}>{label}</span>
          {reminder.notes && (
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">{reminder.notes}</span>
          )}
        </div>
      </div>
      <CompleteReminderButton reminderId={reminder.id} onCompleted={onCompleted} />
    </div>
  );
}

function Section({
  title, subtitle, entries, reminders, dotColor,
  selectionMode, selected, onToggle, onEdit, onLogged, onReminderCompleted,
}: {
  title: string; subtitle?: string; entries: CareEntry[]; reminders: ReminderEntry[]; dotColor: string;
  selectionMode: boolean; selected: Set<string>;
  onToggle: (key: string) => void; onEdit: (plantId: string) => void;
  onLogged: (plantId: string, careType: string) => void;
  onReminderCompleted: (id: string) => void;
}) {
  const total = entries.length + reminders.length;
  if (!total) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={cn("w-2 h-2 rounded-full shrink-0", dotColor)} />
        <h2 className="font-semibold text-sm">{title}</h2>
        {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        <span className="text-xs text-muted-foreground ml-auto">({total})</span>
      </div>
      <div className="space-y-2">
        {entries.map((e, i) => {
          const key = `${e.plantId}-${e.careType}`;
          return (
            <CareCard key={`${key}-${i}`} entry={e} taskKey={key}
              selectionMode={selectionMode} selected={selected.has(key)}
              onToggle={() => onToggle(key)} onEdit={() => onEdit(e.plantId)} onLogged={onLogged} />
          );
        })}
        {reminders.map((r) => (
          <ReminderCard key={r.id} reminder={r}
            selectionMode={selectionMode} selected={selected.has(`reminder-${r.id}`)}
            onToggle={() => onToggle(`reminder-${r.id}`)} onCompleted={() => onReminderCompleted(r.id)} />
        ))}
      </div>
    </div>
  );
}

// ─── Manage Schedules Row ─────────────────────────────────────────────────────

function ManagePlantRow({ plant, selectionMode, selected, onToggle, onEdit }: {
  plant: PlantWithIntervals; selectionMode: boolean; selected: boolean;
  onToggle: () => void; onEdit: () => void;
}) {
  const setIntervals = INTERVAL_DISPLAY.filter(({ key }) => plant[key] !== null);
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition-colors", selected && "border-leaf/50 bg-leaf/5")}>
      {selectionMode && <SelectCheckbox checked={selected} onToggle={onToggle} />}
      <Link href={`/garden/${plant.id}`} className="shrink-0">
        {plant.image
          ? <Image src={plant.image} alt={plant.name} width={40} height={40} className="rounded-lg object-cover border w-10 h-10" />
          : <div className="w-10 h-10 rounded-lg bg-muted border flex items-center justify-center text-sm">🌿</div>
        }
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/garden/${plant.id}`} className="text-sm font-medium hover:text-leaf transition-colors truncate block">{plant.name}</Link>
        {setIntervals.length > 0 ? (
          <div className="flex flex-wrap gap-2 mt-0.5">
            {setIntervals.map(({ key, emoji }) => (
              <span key={key} className="text-xs text-muted-foreground">{emoji} {plant[key]}d</span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">No schedule set</p>
        )}
      </div>
      <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5" title="Edit schedule">
        <Pencil size={13} />
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function CareScheduleClient({
  entries: initialEntries,
  reminderEntries: initialReminders,
  plantsWithoutSchedule: _plantsWithoutSchedule,
  totalWithSchedule,
  plantIntervals,
}: {
  entries: CareEntry[];
  reminderEntries: ReminderEntry[];
  plantsWithoutSchedule: SimplePlant[];
  totalWithSchedule: number;
  plantIntervals: PlantWithIntervals[];
}) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [reminders, setReminders] = useState(initialReminders);
  const [activeTab, setActiveTab] = useState<"week" | "manage">("week");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editPlantIds, setEditPlantIds] = useState<string[] | null>(null);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [bulkLogging, setBulkLogging] = useState(false);

  // Manage tab filter/search
  const [manageFilter, setManageFilter] = useState<"all" | "scheduled" | "notset">("all");
  const [manageSearch, setManageSearch] = useState("");

  const intervalMap = Object.fromEntries(plantIntervals.map((p) => [p.id, p]));
  const editPlants = editPlantIds
    ? (editPlantIds.map((id) => intervalMap[id]).filter(Boolean) as PlantWithIntervals[])
    : [];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const rangeLabel = (a: number, b: number) => `${fmtShort(addDays(today, a))} – ${fmtShort(addDays(today, b))}`;

  // Week Ahead buckets — care entries
  const overdue        = sortAsc(entries.filter((e) => e.daysUntilDue < 0));
  const dueToday       = entries.filter((e) => e.daysUntilDue === 0);
  const thisWeek       = sortAsc(entries.filter((e) => e.daysUntilDue >= 1  && e.daysUntilDue <= 7));
  const nextWeek       = sortAsc(entries.filter((e) => e.daysUntilDue >= 8  && e.daysUntilDue <= 14));
  const laterThisMonth = sortAsc(entries.filter((e) => e.daysUntilDue >= 15 && e.daysUntilDue <= 30));
  const furtherOut     = sortAsc(entries.filter((e) => e.daysUntilDue > 30));

  // Week Ahead buckets — reminders
  const rOverdue        = sortRemindersAsc(reminders.filter((r) => r.daysUntilDue < 0));
  const rDueToday       = reminders.filter((r) => r.daysUntilDue === 0);
  const rThisWeek       = sortRemindersAsc(reminders.filter((r) => r.daysUntilDue >= 1  && r.daysUntilDue <= 7));
  const rNextWeek       = sortRemindersAsc(reminders.filter((r) => r.daysUntilDue >= 8  && r.daysUntilDue <= 14));
  const rLaterThisMonth = sortRemindersAsc(reminders.filter((r) => r.daysUntilDue >= 15 && r.daysUntilDue <= 30));
  const rFurtherOut     = sortRemindersAsc(reminders.filter((r) => r.daysUntilDue > 30));

  // Manage tab — sorted and filtered
  const scheduledCount   = plantIntervals.filter((p) => p.waterInterval || p.fertilizeInterval || p.repotInterval || p.pruneInterval).length;
  const unscheduledCount = plantIntervals.length - scheduledCount;

  const sortedPlants = [...plantIntervals].sort((a, b) => {
    const aHas = !!(a.waterInterval || a.fertilizeInterval || a.repotInterval || a.pruneInterval);
    const bHas = !!(b.waterInterval || b.fertilizeInterval || b.repotInterval || b.pruneInterval);
    if (aHas !== bHas) return aHas ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const filteredPlants = sortedPlants.filter((p) => {
    const hasSchedule = !!(p.waterInterval || p.fertilizeInterval || p.repotInterval || p.pruneInterval);
    if (manageFilter === "scheduled" && !hasSchedule) return false;
    if (manageFilter === "notset" && hasSchedule) return false;
    if (manageSearch.trim()) {
      return p.name.toLowerCase().includes(manageSearch.trim().toLowerCase());
    }
    return true;
  });

  function handleLogged(plantId: string, careType: string) {
    setEntries((prev) => prev.filter((e) => !(e.plantId === plantId && e.careType === careType)));
    router.refresh();
  }

  function handleReminderCompleted(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  function handleReminderAdded(reminder: ReminderEntry) {
    setReminders((prev) => [...prev, reminder].sort((a, b) => a.daysUntilDue - b.daysUntilDue));
    setEditPlantIds(null);
  }

  function toggleSelect(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function switchTab(tab: "week" | "manage") {
    setActiveTab(tab);
    setSelectionMode(false);
    setSelected(new Set());
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelected(new Set());
  }

  async function handleBulkLog() {
    // Separate care tasks from reminders in selection
    const careKeys = [...selected].filter((k) => !k.startsWith("reminder-"));
    const reminderIds = [...selected].filter((k) => k.startsWith("reminder-")).map((k) => k.replace("reminder-", ""));

    const toLog = entries
      .filter((e) => careKeys.includes(`${e.plantId}-${e.careType}`))
      .map((e) => ({ plantId: e.plantId, careType: e.careType }));

    let totalLogged = 0;

    if (toLog.length > 0) {
      setBulkLogging(true);
      const res = await fetch("/api/garden/bulk-log-care", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toLog }),
      });
      setBulkLogging(false);
      if (res.ok) {
        const { logged } = await res.json() as { logged: number };
        totalLogged += logged;
        const loggedKeys = new Set(toLog.map((i) => `${i.plantId}-${i.careType}`));
        setEntries((prev) => prev.filter((e) => !loggedKeys.has(`${e.plantId}-${e.careType}`)));
      } else { toast.error("Failed to log care"); return; }
    }

    for (const id of reminderIds) {
      const res = await fetch(`/api/garden/reminders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      if (res.ok) {
        totalLogged++;
        setReminders((prev) => prev.filter((r) => r.id !== id));
      }
    }

    if (totalLogged > 0) {
      toast.success(`Logged ${totalLogged} task${totalLogged !== 1 ? "s" : ""}`);
      exitSelectionMode();
      router.refresh();
    }
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
    onReminderCompleted: handleReminderCompleted,
  };

  const hasAnyPlants = plantIntervals.length > 0;
  const hasWeekContent = totalWithSchedule > 0 || reminders.length > 0;

  return (
    <>
      <div className={cn("space-y-6", selectionMode && "pb-20")}>

        {/* Sub-tab navigation */}
        <div className="flex gap-2 p-1 bg-muted/40 rounded-lg w-fit">
          {(["week", "manage"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => switchTab(tab)}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === tab
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab === "week" ? "Week Ahead" : "Manage Schedules"}
            </button>
          ))}
        </div>

        {/* ── WEEK AHEAD TAB ── */}
        {activeTab === "week" && (
          <div className="space-y-8">
            {/* Week Ahead header row */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {hasAnyPlants && (
                  <Button
                    variant="outline" size="sm"
                    onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}
                  >
                    {selectionMode ? "Done" : "Select tasks"}
                  </Button>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddReminder(true)}
                className="flex items-center gap-1.5"
              >
                <Plus size={13} /> Add reminder
              </Button>
            </div>

            {hasWeekContent && (
              <WeekStrip
                entries={entries}
                reminders={reminders}
                onLogged={handleLogged}
                onReminderCompleted={handleReminderCompleted}
              />
            )}

            {totalWithSchedule === 0 && !reminders.length && hasAnyPlants && (
              <div className="rounded-xl border bg-muted/30 px-5 py-6 space-y-1.5">
                <p className="font-semibold text-sm">No care schedules set up yet</p>
                <p className="text-sm text-muted-foreground">
                  Switch to{" "}
                  <button onClick={() => switchTab("manage")} className="font-medium text-foreground underline underline-offset-2">
                    Manage Schedules
                  </button>{" "}
                  to set up watering, fertilizing, repotting, or pruning intervals for your plants.
                </p>
              </div>
            )}

            <Section title="Overdue"     dotColor="bg-red-500"          entries={overdue}        reminders={rOverdue}        {...sharedSectionProps} />
            <Section title="Due Today"   dotColor="bg-amber-500"        entries={dueToday}       reminders={rDueToday}       {...sharedSectionProps} />
            <Section title="This Week"   dotColor="bg-leaf"             entries={thisWeek}       reminders={rThisWeek}       subtitle={rangeLabel(1, 7)}   {...sharedSectionProps} />
            <Section title="Next Week"   dotColor="bg-teal-500"         entries={nextWeek}       reminders={rNextWeek}       subtitle={rangeLabel(8, 14)}  {...sharedSectionProps} />
            <Section title="This Month"  dotColor="bg-violet-400"       entries={laterThisMonth} reminders={rLaterThisMonth} subtitle={rangeLabel(15, 30)} {...sharedSectionProps} />
            <Section title="Further Out" dotColor="bg-muted-foreground" entries={furtherOut}     reminders={rFurtherOut}     subtitle={`after ${fmtShort(addDays(today, 30))}`} {...sharedSectionProps} />

            {!hasAnyPlants && !reminders.length && (
              <div className="text-center py-20 border rounded-xl bg-muted/30">
                <p className="text-4xl mb-3">🌱</p>
                <p className="font-semibold mb-1">No plants yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add plants to your garden to set up care schedules.</p>
                <Link href="/garden/new" className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors">
                  Add your first plant
                </Link>
              </div>
            )}
          </div>
        )}

        {/* ── MANAGE SCHEDULES TAB ── */}
        {activeTab === "manage" && (
          <div className="space-y-4">
            {!hasAnyPlants ? (
              <div className="text-center py-20 border rounded-xl bg-muted/30">
                <p className="text-4xl mb-3">🌱</p>
                <p className="font-semibold mb-1">No plants yet</p>
                <p className="text-sm text-muted-foreground mb-4">Add plants to your garden first.</p>
                <Link href="/garden/new" className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors">
                  Add your first plant
                </Link>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={manageSearch}
                    onChange={(e) => setManageSearch(e.target.value)}
                    placeholder="Search plants…"
                    className="pl-8 h-9 text-sm"
                  />
                  {manageSearch && (
                    <button onClick={() => setManageSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X size={13} />
                    </button>
                  )}
                </div>

                {/* Filter tabs + actions */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md">
                    {(["all", "scheduled", "notset"] as const).map((f) => {
                      const labels = { all: `All (${plantIntervals.length})`, scheduled: `Scheduled (${scheduledCount})`, notset: `Not set (${unscheduledCount})` };
                      return (
                        <button key={f} onClick={() => setManageFilter(f)}
                          className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                            manageFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                          )}>
                          {labels[f]}
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="outline" size="sm" onClick={() => selectionMode ? exitSelectionMode() : setSelectionMode(true)}>
                    {selectionMode ? "Done" : "Select plants"}
                  </Button>
                </div>

                {filteredPlants.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No plants match your filter.</p>
                ) : (
                  <div className="space-y-2">
                    {filteredPlants.map((plant) => (
                      <ManagePlantRow
                        key={plant.id}
                        plant={plant}
                        selectionMode={selectionMode}
                        selected={selected.has(plant.id)}
                        onToggle={() => toggleSelect(plant.id)}
                        onEdit={() => setEditPlantIds([plant.id])}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">
            {selected.size > 0 ? `${selected.size} selected` : "Select items"}
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exitSelectionMode}>Cancel</Button>
            {activeTab === "week" && selected.size > 0 && (
              <Button size="sm" variant="outline" onClick={handleBulkLog} disabled={bulkLogging}>
                {bulkLogging ? "Logging…" : "Log selected"}
              </Button>
            )}
            {activeTab === "manage" && selected.size > 0 && (
              <Button size="sm" className="bg-leaf hover:bg-forest text-white" onClick={() => setEditPlantIds([...selected])}>
                Update intervals
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Intervals + one-time modal */}
      <Dialog open={editPlantIds !== null} onOpenChange={(open: boolean) => { if (!open) setEditPlantIds(null); }}>
        {editPlants.length > 0 && (
          <IntervalsModal plants={editPlants} onSaved={handleSaved} onReminderAdded={handleReminderAdded} />
        )}
      </Dialog>

      {/* Standalone add-reminder modal */}
      <Dialog open={showAddReminder} onOpenChange={(open: boolean) => { if (!open) setShowAddReminder(false); }}>
        {showAddReminder && (
          <AddReminderModal
            plants={plantIntervals}
            onAdded={(r) => { handleReminderAdded(r); setShowAddReminder(false); }}
            onClose={() => setShowAddReminder(false)}
          />
        )}
      </Dialog>
    </>
  );
}
