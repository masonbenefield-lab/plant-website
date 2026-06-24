"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Droplets, Leaf, Flower2, Scissors, Pencil, Check, ChevronDown, ChevronLeft, ChevronRight,
  StickyNote, Plus, Search, X, Syringe, Wheat, Clock, Sparkles, Moon, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Types ────────────────────────────────────────────────────────────────────

type CareEntry = {
  plantId: string;
  plantName: string;
  image: string | null;
  location: string | null;
  careType: string;
  eventKey: string;
  interval: number;
  lastDate: string | null;
  daysUntilDue: number;
  snoozeUntil: string | null;
  isCustom?: boolean;
  scheduleId?: string;
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

export type CompletedCareEntry = {
  plantId: string;
  plantName: string;
  image: string | null;
  location: string | null;
  careType: string;
};

export type CustomSchedule = {
  id: string;
  label: string;
  interval_days: number;
  start_date: string;
};

export type PlantWithIntervals = {
  id: string;
  name: string;
  image: string | null;
  location: string | null;
  waterInterval: number | null;
  fertilizeInterval: number | null;
  repotInterval: number | null;
  pruneInterval: number | null;
  customSchedules: CustomSchedule[];
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

function getCareMeta(careType: string) {
  return CARE_META[careType] ?? {
    icon: <Sparkles size={13} />,
    color: "text-violet-700 dark:text-violet-400",
    bg: "bg-violet-100 dark:bg-violet-900/30",
    border: "border-violet-200 dark:border-violet-800",
  };
}

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0)  return { label: `${Math.abs(days)}d overdue`, color: "text-red-600 dark:text-red-400" };
  if (days === 0) return { label: "Due today",                  color: "text-amber-600 dark:text-amber-400" };
  if (days === 1) return { label: "Tomorrow",                   color: "text-leaf" };
  return { label: `In ${days}d`, color: "text-leaf" };
}

function getFieldMeta(values: (number | null)[]): { defaultValue: string; placeholder: string } {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return { defaultValue: "", placeholder: "Not set" };
  const unique = [...new Set(nonNull)].sort((a, b) => a - b);
  if (unique.length === 1 && nonNull.length === values.length) return { defaultValue: String(unique[0]), placeholder: "" };
  const parts = unique.map((v) => `${v}d`);
  if (nonNull.length < values.length) parts.push("not set");
  return { defaultValue: "", placeholder: `Currently: ${parts.join(", ")}` };
}

// Returns day offsets [0–6] where this recurring entry falls
function getStripDays(daysUntilDue: number, interval: number): Set<number> {
  const days = new Set<number>();
  // Overdue tasks (negative) belong in today's Overdue bucket — never project
  // them forward onto a future day in the strip.
  if (daysUntilDue < 0) return days;
  let d = daysUntilDue;
  while (d <= 6) { days.add(d); d += interval; }
  return days;
}

function reminderDisplayType(eventType: string): string {
  return EVENT_TYPE_TO_DISPLAY[eventType] ?? eventType;
}
function reminderMeta(eventType: string) {
  return CARE_META[reminderDisplayType(eventType)] ?? CARE_META["Note"];
}

// ─── SelectCheckbox ───────────────────────────────────────────────────────────

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

// ─── Day panel rows ───────────────────────────────────────────────────────────

function DayTaskRow({ entry, logDate, selected, onToggle, onLog, onEditSchedule, onViewHistory, compact }: {
  entry: CareEntry; logDate: string; selected: boolean; isToday?: boolean; onToggle: () => void;
  onLog: (eventId: string, withNote: boolean) => void; onEditSchedule?: () => void; onViewHistory?: () => void;
  compact?: boolean;
}) {
  const meta = getCareMeta(entry.careType);
  const { label, color } = urgencyLabel(entry.daysUntilDue);
  const [loading, setLoading] = useState(false);

  async function handleLog(withNote: boolean) {
    setLoading(true);
    const res = await fetch("/api/garden/log-care", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: entry.plantId, careType: entry.careType, eventKey: entry.eventKey, date: logDate }),
    });
    setLoading(false);
    if (res.ok) {
      const { eventId } = await res.json() as { eventId: string };
      toast.success(`${entry.careType} logged!`);
      onLog(eventId, withNote);
    } else toast.error("Failed to log");
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2 transition-colors",
      !compact && "rounded-lg border bg-background",
      !compact && selected && "border-leaf/40 bg-leaf/5",
      compact && selected && "bg-leaf/5",
    )}>
      <SelectCheckbox checked={selected} onToggle={onToggle} />
      {!compact && (
        <Link href={`/garden/${entry.plantId}`} className="shrink-0">
          {entry.image
            ? <Image src={entry.image} alt={entry.plantName} width={36} height={36} className="rounded-md object-cover border w-9 h-9" />
            : <div className="w-9 h-9 rounded-md bg-muted border flex items-center justify-center text-sm">🌿</div>
          }
        </Link>
      )}
      <div className="flex-1 min-w-0">
        {!compact && (
          <div className="flex items-center gap-1.5 min-w-0">
            <Link href={`/garden/${entry.plantId}`} className="text-xs font-medium hover:text-leaf transition-colors truncate">{entry.plantName}</Link>
            {entry.location && <span className="text-[10px] text-muted-foreground truncate shrink-0">· {entry.location}</span>}
          </div>
        )}
        <div className={cn("flex items-center gap-1.5", !compact && "mt-0.5")}>
          <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {entry.careType}
          </span>
          <span className={cn("text-[11px] font-medium", color)}>{label}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {onViewHistory && (
          <button onClick={onViewHistory} className="text-muted-foreground hover:text-foreground transition-colors" title="View history">
            <Clock size={13} />
          </button>
        )}
        {onEditSchedule && (
          <button onClick={onEditSchedule} className="text-muted-foreground hover:text-foreground transition-colors" title="Edit schedule">
            <Pencil size={13} />
          </button>
        )}
        <button
          onClick={() => handleLog(true)} disabled={loading}
          className="text-muted-foreground hover:text-foreground disabled:opacity-50 transition-colors"
          title="Log with note"
        >
          <StickyNote size={13} />
        </button>
        <button onClick={() => handleLog(false)} disabled={loading} className="text-xs font-medium text-leaf hover:text-forest disabled:opacity-50 transition-colors whitespace-nowrap">
          {loading ? "…" : "Log ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── Plant group header (used when a plant has 2+ tasks in the day panel) ─────

function PlantGroupHeader({ entry, allSelected, onToggleAll, onLogAll }: {
  entry: CareEntry; allSelected: boolean; onToggleAll: () => void; onLogAll: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 bg-muted/40">
      <SelectCheckbox checked={allSelected} onToggle={onToggleAll} />
      <Link href={`/garden/${entry.plantId}`} className="shrink-0">
        {entry.image
          ? <Image src={entry.image} alt={entry.plantName} width={28} height={28} className="rounded-md object-cover border w-7 h-7" />
          : <div className="w-7 h-7 rounded-md bg-muted border flex items-center justify-center text-xs">🌿</div>
        }
      </Link>
      <div className="flex-1 min-w-0">
        <Link href={`/garden/${entry.plantId}`} className="text-xs font-semibold truncate hover:text-leaf transition-colors block">{entry.plantName}</Link>
        {entry.location && <span className="text-[10px] text-muted-foreground">{entry.location}</span>}
      </div>
      <button onClick={onLogAll} className="text-[11px] font-medium text-leaf hover:text-forest transition-colors whitespace-nowrap shrink-0">
        Log all →
      </button>
    </div>
  );
}

function ReminderNoteDialog({ reminder, open, onClose }: { reminder: ReminderEntry; open: boolean; onClose: () => void }) {
  const meta = reminderMeta(reminder.eventType);
  const displayType = reminderDisplayType(reminder.eventType);
  const dateLabel = new Date(reminder.scheduledDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{reminder.plantName ?? "Garden note"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
              {meta.icon} {displayType}
            </span>
            <span className="text-xs text-muted-foreground">{dateLabel}</span>
          </div>
          {reminder.notes ? (
            <p className="text-sm leading-relaxed">{reminder.notes}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No notes added.</p>
          )}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function DayReminderRow({ reminder, selected, onToggle, onComplete }: {
  reminder: ReminderEntry; selected: boolean; onToggle: () => void; onComplete: () => void;
}) {
  const meta = reminderMeta(reminder.eventType);
  const displayType = reminderDisplayType(reminder.eventType);
  const { label, color } = urgencyLabel(reminder.daysUntilDue);
  const [loading, setLoading] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  async function handleComplete() {
    setLoading(true);
    const res = await fetch(`/api/garden/reminders/${reminder.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true }),
    });
    setLoading(false);
    if (res.ok) { toast.success("Done!"); onComplete(); }
    else toast.error("Failed");
  }

  return (
    <>
      <div className={cn("flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2 transition-colors", selected && "border-leaf/40 bg-leaf/5")}>
        <SelectCheckbox checked={selected} onToggle={onToggle} />
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
        <button className="flex-1 min-w-0 text-left group" onClick={() => setNoteOpen(true)}>
          <div className="flex items-center gap-1 min-w-0">
            <span className="text-xs font-medium truncate group-hover:text-leaf transition-colors">{reminder.plantName ?? "Garden note"}</span>
            <ChevronRight size={10} className="text-muted-foreground/40 group-hover:text-leaf transition-colors shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
              {meta.icon} {displayType}
            </span>
            <span className={cn("text-[11px] font-medium", color)}>{label}</span>
            {reminder.notes && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[140px]">{reminder.notes}</span>
            )}
          </div>
        </button>
        <button onClick={handleComplete} disabled={loading} className="text-xs font-medium text-leaf hover:text-forest disabled:opacity-50 transition-colors whitespace-nowrap shrink-0">
          {loading ? "…" : "Done ✓"}
        </button>
      </div>
      <ReminderNoteDialog reminder={reminder} open={noteOpen} onClose={() => setNoteOpen(false)} />
    </>
  );
}

// ─── Log Notes Dialog ─────────────────────────────────────────────────────────

function LogNotesDialog({ events, open, onClose }: {
  events: { eventId: string; plantName: string; careType: string }[];
  open: boolean;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(events.map((e) => [e.eventId, ""]))
  );
  const [saving, setSaving] = useState(false);

  async function save() {
    const toSave = events
      .map((e) => ({ eventId: e.eventId, notes: notes[e.eventId] ?? "" }))
      .filter((e) => e.notes.trim());
    if (toSave.length === 0) { onClose(); return; }
    setSaving(true);
    const res = await fetch("/api/garden/log-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: toSave }),
    });
    setSaving(false);
    if (res.ok) toast.success("Notes saved!");
    else toast.error("Failed to save notes");
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add notes <span className="text-muted-foreground font-normal text-sm">(optional)</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1 max-h-72 overflow-y-auto pr-1">
          {events.map((e) => {
            const meta = CARE_META[e.careType] ?? CARE_META["Note"];
            return (
              <div key={e.eventId} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
                    {meta.icon} {e.careType}
                  </span>
                  <span className="text-xs font-medium truncate">{e.plantName}</span>
                </div>
                <textarea
                  value={notes[e.eventId] ?? ""}
                  onChange={(ev) => setNotes((p) => ({ ...p, [e.eventId]: ev.target.value }))}
                  placeholder="Optional note…"
                  rows={2}
                  className="w-full text-xs rounded-md border border-input bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            );
          })}
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={save} disabled={saving} className="bg-leaf hover:bg-forest text-white">
            {saving ? "Saving…" : "Save notes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bulk confirm + notes dialog ─────────────────────────────────────────────

function BulkConfirmDialog({ careItems, reminderItems, open, onClose, onConfirm, confirming }: {
  careItems: CareEntry[];
  reminderItems: ReminderEntry[];
  open: boolean;
  onClose: () => void;
  onConfirm: (sharedNote: string, individualNotes: Record<string, string>) => void;
  confirming: boolean;
}) {
  const [sharedNote, setSharedNote] = useState("");
  const [individualNotes, setIndividualNotes] = useState<Record<string, string>>({});
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const total = careItems.length + reminderItems.length;

  function handleClose() {
    setSharedNote(""); setIndividualNotes({}); setExpandedItems(new Set()); onClose();
  }
  function toggleExpand(key: string) {
    setExpandedItems((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log {total} task{total !== 1 ? "s" : ""}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          {careItems.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm text-muted-foreground">Note <span className="text-xs">(optional · applies to all)</span></p>
              <textarea
                value={sharedNote}
                onChange={(e) => setSharedNote(e.target.value)}
                placeholder="Add a shared note…"
                rows={2}
                className="w-full text-xs rounded-md border border-input bg-background px-2.5 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {careItems.map((e) => {
              const meta = CARE_META[e.careType];
              const key = `${e.plantId}-${e.careType}`;
              return (
                <div key={key}>
                  <div className="flex items-center gap-2">
                    <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border shrink-0", meta.bg, meta.color, meta.border)}>
                      {meta.icon} {e.careType}
                    </span>
                    <span className="text-xs text-muted-foreground truncate flex-1">{e.plantName}</span>
                    <button
                      onClick={() => toggleExpand(key)}
                      className={cn("shrink-0 transition-colors", expandedItems.has(key) ? "text-leaf" : "text-muted-foreground/40 hover:text-muted-foreground")}
                      title="Add individual note"
                    >
                      <StickyNote size={11} />
                    </button>
                  </div>
                  {expandedItems.has(key) && (
                    <textarea
                      value={individualNotes[key] ?? ""}
                      onChange={(ev) => setIndividualNotes((p) => ({ ...p, [key]: ev.target.value }))}
                      placeholder="Individual note (overrides shared)…"
                      rows={1}
                      className="w-full mt-1 text-xs rounded-md border border-input bg-background px-2.5 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  )}
                </div>
              );
            })}
            {reminderItems.map((r) => {
              const meta = reminderMeta(r.eventType);
              const displayType = reminderDisplayType(r.eventType);
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border shrink-0", meta.bg, meta.color, meta.border)}>
                    {meta.icon} {displayType}
                  </span>
                  <span className="text-xs text-muted-foreground truncate">{r.plantName ?? "Garden note"}</span>
                </div>
              );
            })}
          </div>
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={() => onConfirm(sharedNote, individualNotes)} disabled={confirming} className="bg-leaf hover:bg-forest text-white">
            {confirming ? "Logging…" : `Log ${total} task${total !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DoneEntryRow({ entry, onUndo, onAddNote, selected, onToggle }: {
  entry: LoggedEntry; onUndo: () => void; onAddNote?: () => void;
  selected?: boolean; onToggle?: () => void;
}) {
  const meta = CARE_META[entry.careType];
  return (
    <div className={cn("flex items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2 opacity-60 hover:opacity-80 transition-opacity", selected && "opacity-100 border-leaf/40 bg-leaf/5")}>
      <SelectCheckbox checked={selected ?? false} onToggle={() => onToggle?.()} />
      <Link href={`/garden/${entry.plantId}`} className="shrink-0">
        {entry.image
          ? <Image src={entry.image} alt={entry.plantName} width={28} height={28} className="rounded-md object-cover border w-7 h-7" />
          : <div className="w-7 h-7 rounded-md bg-muted border flex items-center justify-center text-xs">🌿</div>
        }
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href={`/garden/${entry.plantId}`} className="text-xs text-muted-foreground line-through truncate hover:text-foreground transition-colors">
            {entry.plantName}
          </Link>
          {entry.location && <span className="text-[10px] text-muted-foreground/70 truncate shrink-0">· {entry.location}</span>}
        </div>
        <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border mt-0.5 line-through", meta.bg, meta.color, meta.border)}>
          {meta.icon} {entry.careType}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {entry.eventId && onAddNote && (
          <button onClick={onAddNote} className="text-muted-foreground hover:text-foreground transition-colors" title="Add note">
            <StickyNote size={12} />
          </button>
        )}
        <button onClick={onUndo} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap">
          Undo
        </button>
      </div>
    </div>
  );
}

function DoneReminderRow({ reminder, onUndo }: { reminder: ReminderEntry; onUndo: () => void }) {
  const meta = reminderMeta(reminder.eventType);
  const displayType = reminderDisplayType(reminder.eventType);
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2.5 rounded-lg border bg-background/50 px-3 py-2 opacity-60 hover:opacity-80 transition-opacity">
        <Check size={14} className="text-leaf shrink-0" />
        {reminder.plantId ? (
          <Link href={`/garden/${reminder.plantId}`} className="shrink-0">
            {reminder.image
              ? <Image src={reminder.image} alt={reminder.plantName ?? ""} width={28} height={28} className="rounded-md object-cover border w-7 h-7" />
              : <div className="w-7 h-7 rounded-md bg-muted border flex items-center justify-center text-xs">🌿</div>
            }
          </Link>
        ) : (
          <div className="w-7 h-7 rounded-md bg-muted border flex items-center justify-center text-xs shrink-0">📝</div>
        )}
        <button className="flex-1 min-w-0 text-left" onClick={() => setNoteOpen(true)}>
          <span className="text-xs text-muted-foreground line-through truncate block">
            {reminder.plantName ?? "Garden note"}
          </span>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border line-through", meta.bg, meta.color, meta.border)}>
              {meta.icon} {displayType}
            </span>
            {reminder.notes && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[120px]">{reminder.notes}</span>
            )}
          </div>
        </button>
        <button onClick={onUndo} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0">
          Undo
        </button>
      </div>
      <ReminderNoteDialog reminder={reminder} open={noteOpen} onClose={() => setNoteOpen(false)} />
    </>
  );
}

// ─── WeekStrip (self-contained: strip + day panel + logging state) ────────────

type LoggedEntry    = CompletedCareEntry & { actualDay: number; eventId?: string; logDate?: string };
type LoggedReminder = { reminder: ReminderEntry; actualDay: number };

function WeekStrip({
  entries, reminders, completedToday, onLogged, onReminderCompleted, onReminderUncompleted, onEditSchedule, onViewHistory, vacationActive, onSnooze, snoozedEntryKeys,
}: {
  entries: CareEntry[];
  reminders: ReminderEntry[];
  completedToday: CompletedCareEntry[];
  onLogged: (plantId: string, careType: string) => void;
  onReminderCompleted: (id: string) => void;
  onReminderUncompleted: (reminder: ReminderEntry) => void;
  onEditSchedule?: (plantId: string) => void;
  onViewHistory?: (plantId: string) => void;
  vacationActive?: boolean;
  onSnooze?: (entries: CareEntry[]) => void;
  snoozedEntryKeys?: Set<string>;
}) {
  // weekOffset: 0 = this week, -7 = last week, -14 = two weeks ago …
  const [weekOffset, setWeekOffset]   = useState(0);
  const [selectedDay, setSelectedDay] = useState<number | null>(0); // index 0–6 within strip
  // Pre-seed with today's already-logged events so completed list survives navigation
  const [loggedKeys, setLoggedKeys]   = useState<Set<string>>(
    () => new Set(completedToday.map((c) => `${c.plantId}-${c.careType}`))
  );
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  // Explicit done lists — survive router.refresh() because they're React state, not derived
  const [doneEntryList, setDoneEntryList] = useState<LoggedEntry[]>(
    () => completedToday.map((c) => ({ ...c, actualDay: 0 }))
  );
  const [doneReminderList, setDoneReminderList] = useState<LoggedReminder[]>([]);
  const [panelSelected, setPanelSelected] = useState<Set<string>>(new Set());
  const [bulkLogging, setBulkLogging]     = useState(false);
  const [notesDialogEvents, setNotesDialogEvents] = useState<{ eventId: string; plantName: string; careType: string }[] | null>(null);
  const [bulkConfirmState, setBulkConfirmState] = useState<{ careItems: CareEntry[]; reminderItems: ReminderEntry[]; date: string } | null>(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [doneSelected, setDoneSelected] = useState<Set<string>>(new Set());
  const [overdueDismissed, setOverdueDismissed] = useState(false);
  const [dayTab, setDayTab] = useState<"due" | "overdue">("overdue");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isCurrentWeek = weekOffset === 0;
  const isFutureWeek = weekOffset > 0;

  // Overdue task count (for the "missed tasks" chip when on current week — hidden during vacation)
  const overdueCount = isCurrentWeek && !overdueDismissed && !vacationActive
    ? entries.filter((e) => e.daysUntilDue < 0 && !loggedKeys.has(`${e.plantId}-${e.careType}`)).length
    : 0;

  // Strip days: actual offset from today = weekOffset + i
  const days = Array.from({ length: 7 }, (_, i) => {
    const actualOffset = weekOffset + i;
    const date = addDays(today, actualOffset);
    const isPast  = actualOffset < 0;
    const isToday = actualOffset === 0;

    const careCount = entries.reduce((sum, e) => {
      // Only filter logged tasks while they still show as due-today/overdue.
      // After router.refresh() daysUntilDue becomes interval (> 0) and they
      // should reappear in their future strip slot.
      if (loggedKeys.has(`${e.plantId}-${e.careType}`) && e.daysUntilDue <= 0) return sum;
      if (isPast) {
        return e.daysUntilDue === actualOffset ? sum + 1 : sum;
      }
      // Overdue tasks all count toward today's total, no matter how overdue.
      if (isToday && e.daysUntilDue < 0) return sum + 1;
      return sum + (getStripDays(e.daysUntilDue, e.interval).has(actualOffset) ? 1 : 0);
    }, 0);

    const reminderCount = reminders.filter((r) => {
      if (completedIds.has(r.id)) return false;
      return r.daysUntilDue === actualOffset;
    }).length;

    return {
      i, actualOffset, isPast, isToday,
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      dateNum: date.getDate(),
      monthLabel: date.toLocaleDateString("en-US", { month: "short" }),
      count: careCount + reminderCount,
    };
  });

  const weekTotal = days.reduce((s, d) => s + d.count, 0);

  // Actual calendar offset for the selected strip day
  const actualSelectedOffset = selectedDay !== null ? weekOffset + selectedDay : null;

  // ISO date string for the currently viewed day (used when logging past tasks)
  const logDate: string = (() => {
    if (actualSelectedOffset === null) return todayStr();
    const d = addDays(today, actualSelectedOffset);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // Next upcoming task offset beyond this week (for "all clear" display)
  const nextTaskOffset: number | null = (() => {
    if (!isCurrentWeek || weekTotal > 0) return null;
    let min = Infinity;
    for (const e of entries) {
      if (loggedKeys.has(`${e.plantId}-${e.careType}`) && e.daysUntilDue <= 0) continue;
      let d = e.daysUntilDue;
      if (d < 0) d += Math.ceil(Math.abs(d) / e.interval) * e.interval;
      while (d <= 6) d += e.interval;
      if (d < min) min = d;
    }
    for (const r of reminders) {
      if (completedIds.has(r.id)) continue;
      if (r.daysUntilDue > 6) min = Math.min(min, r.daysUntilDue);
    }
    return min === Infinity ? null : min;
  })();

  // Day panel: active tasks
  const dayEntries = actualSelectedOffset !== null
    ? entries.filter((e) => {
        if (actualSelectedOffset === 0 && snoozedEntryKeys?.has(`${e.plantId}-${e.eventKey}`)) return false; // optimistically hidden after snooze (today only)
        // Same rule as strip counts: only hide while daysUntilDue ≤ 0
        if (loggedKeys.has(`${e.plantId}-${e.careType}`) && e.daysUntilDue <= 0) return false;
        if (actualSelectedOffset < 0) return e.daysUntilDue === actualSelectedOffset;
        // Overdue tasks show in today's panel regardless of how overdue they are.
        if (actualSelectedOffset === 0 && e.daysUntilDue < 0) return true;
        return getStripDays(e.daysUntilDue, e.interval).has(actualSelectedOffset);
      })
    : [];
  const dayReminders = actualSelectedOffset !== null
    ? reminders.filter((r) => !completedIds.has(r.id) && r.daysUntilDue === actualSelectedOffset)
    : [];

  // Done items: driven by explicit lists so they survive router.refresh()
  const currentDoneEntries = actualSelectedOffset !== null
    ? doneEntryList.filter((d) => d.actualDay === actualSelectedOffset)
    : [];
  const currentDoneReminders = actualSelectedOffset !== null
    ? doneReminderList.filter((d) => d.actualDay === actualSelectedOffset).map((d) => d.reminder)
    : [];

  const hasActive = dayEntries.length > 0 || dayReminders.length > 0;
  const hasDone   = currentDoneEntries.length > 0 || currentDoneReminders.length > 0;
  const totalActive = dayEntries.length + dayReminders.length;

  // Today-only tab split: genuine overdue vs due today
  const isSelectedToday = actualSelectedOffset === 0;
  const overdueEntries = isSelectedToday
    ? dayEntries.filter((e) => e.daysUntilDue < 0)
    : [];
  const dueTodayEntries = isSelectedToday
    ? dayEntries.filter((e) => e.daysUntilDue >= 0)
    : dayEntries;
  const showDayTabs = isSelectedToday && overdueEntries.length > 0 && dueTodayEntries.length > 0;
  const activeEntries = showDayTabs ? (dayTab === "overdue" ? overdueEntries : dueTodayEntries) : dayEntries;

  // Reset tab and selection when the viewed day changes
  useEffect(() => {
    setDayTab("overdue");
    setPanelSelected(new Set());
  }, [actualSelectedOffset]);

  function togglePanel(key: string) {
    setPanelSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  function handleLog(plantId: string, careType: string, eventId: string, withNote: boolean) {
    const key = `${plantId}-${careType}`;
    if (actualSelectedOffset !== null) {
      const entry = entries.find((e) => e.plantId === plantId && e.careType === careType);
      if (entry) {
        setDoneEntryList((p) => [...p, { plantId: entry.plantId, plantName: entry.plantName, image: entry.image, location: entry.location, careType: entry.careType, actualDay: actualSelectedOffset, eventId, logDate }]);
        if (withNote) setNotesDialogEvents([{ eventId, plantName: entry.plantName, careType: entry.careType }]);
      }
    }
    if (actualSelectedOffset === 0) setLoggedKeys((p) => new Set([...p, key]));
    setPanelSelected((p) => { const n = new Set(p); n.delete(key); return n; });
    onLogged(plantId, careType);
  }

  function handleReminderDone(id: string) {
    if (actualSelectedOffset !== null) {
      const reminder = reminders.find((r) => r.id === id);
      if (reminder) setDoneReminderList((p) => [...p, { reminder, actualDay: actualSelectedOffset }]);
    }
    setCompletedIds((p) => new Set([...p, id]));
    setPanelSelected((p) => { const n = new Set(p); n.delete(`reminder-${id}`); return n; });
    onReminderCompleted(id);
  }

  async function handleUnlog(plantId: string, careType: string, date?: string) {
    const res = await fetch("/api/garden/unlog-care", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, careType, date }),
    });
    if (res.ok) {
      const key = `${plantId}-${careType}`;
      setLoggedKeys((p) => { const n = new Set(p); n.delete(key); return n; });
      setDoneEntryList((p) => p.filter((d) => !(d.plantId === plantId && d.careType === careType)));
      toast.success("Unlogged");
      onLogged(plantId, careType); // triggers router.refresh() to recalculate
    } else {
      toast.error("Couldn't unlog — it may have already been removed");
    }
  }

  async function handleUndoReminder(id: string) {
    const res = await fetch(`/api/garden/reminders/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: false }),
    });
    if (res.ok) {
      const done = doneReminderList.find((d) => d.reminder.id === id);
      if (done) {
        setDoneReminderList((p) => p.filter((d) => d.reminder.id !== id));
        setCompletedIds((p) => { const n = new Set(p); n.delete(id); return n; });
        onReminderUncompleted(done.reminder);
      }
      toast.success("Reminder restored");
    } else {
      toast.error("Failed to restore reminder");
    }
  }

  function logAllOverdue() {
    const overdueEntries = entries.filter((e) => e.daysUntilDue < 0 && !loggedKeys.has(`${e.plantId}-${e.careType}`));
    if (!overdueEntries.length) return;
    setBulkConfirmState({ careItems: overdueEntries, reminderItems: [], date: todayStr() });
  }

  function dismissAllOverdue() {
    setOverdueDismissed(true);
  }

  async function performBulkLog(careItems: CareEntry[], reminderItems: ReminderEntry[], sharedNote: string, individualNotes: Record<string, string>, date: string) {
    setBulkLogging(true);
    const snapshotOffset = actualSelectedOffset;
    const snapshotLogDate = date;
    const toLog = careItems.map((e) => ({ plantId: e.plantId, careType: e.careType }));
    let logged = 0;

    if (toLog.length > 0) {
      const res = await fetch("/api/garden/bulk-log-care", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: toLog, date: snapshotLogDate }),
      });
      if (res.ok) {
        const { logged: n, events: bulkEvents } = await res.json() as { logged: number; events: { eventId: string; plantId: string; plantName: string; careType: string }[] };
        logged += n;
        if (snapshotOffset !== null) {
          const bulkEventMap = Object.fromEntries((bulkEvents ?? []).map((ev) => [`${ev.plantId}-${ev.careType}`, ev.eventId]));
          careItems.forEach(({ plantId, careType }) => {
            const entry = entries.find((e) => e.plantId === plantId && e.careType === careType);
            const eventId = bulkEventMap[`${plantId}-${careType}`];
            if (entry) setDoneEntryList((p) => [...p, { plantId: entry.plantId, plantName: entry.plantName, image: entry.image, location: entry.location, careType: entry.careType, actualDay: snapshotOffset, eventId, logDate: snapshotLogDate }]);
          });
        }
        if (snapshotOffset === 0) setLoggedKeys((p) => new Set([...p, ...toLog.map((i) => `${i.plantId}-${i.careType}`)]));
        careItems.forEach(({ plantId, careType }) => onLogged(plantId, careType));
        if (bulkEvents?.length) {
          const eventsWithNotes = bulkEvents
            .map((ev) => ({ eventId: ev.eventId, notes: (individualNotes[`${ev.plantId}-${ev.careType}`]?.trim() || sharedNote.trim()) }))
            .filter((ev) => ev.notes);
          if (eventsWithNotes.length) {
            await fetch("/api/garden/log-notes", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ events: eventsWithNotes }),
            });
          }
        }
      }
    }

    for (const r of reminderItems) {
      const res = await fetch(`/api/garden/reminders/${r.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: true }),
      });
      if (res.ok) {
        logged++;
        if (snapshotOffset !== null) setDoneReminderList((p) => [...p, { reminder: r, actualDay: snapshotOffset }]);
        setCompletedIds((p) => new Set([...p, r.id]));
        onReminderCompleted(r.id);
      }
    }

    setBulkLogging(false);
    if (logged > 0) {
      toast.success(`Logged ${logged} task${logged !== 1 ? "s" : ""}`);
      setPanelSelected(new Set());
    }
  }

  function navigate(dir: -1 | 1) {
    const next = Math.max(-21, Math.min(21, weekOffset + dir * 7));
    setWeekOffset(next);
    setSelectedDay(dir === -1 ? 6 : 0); // land on last day when going back, first when going forward
    setPanelSelected(new Set());
  }

  function goToToday() {
    setWeekOffset(0);
    setSelectedDay(0);
    setPanelSelected(new Set());
  }

  function dayHeading(actualOffset: number) {
    if (actualOffset === 0) return "Today";
    if (actualOffset === 1) return "Tomorrow";
    if (actualOffset === -1) return "Yesterday";
    return addDays(today, actualOffset).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }

  return (
    <div className="space-y-3">
      {/* Overdue chip — only when on current week and tasks are overdue */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-1.5 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            {overdueCount} task{overdueCount !== 1 ? "s" : ""} missed — view past days
            <ChevronLeft size={12} />
          </button>
          <button onClick={logAllOverdue} className="text-xs font-medium text-leaf hover:text-forest transition-colors">
            Log all
          </button>
          <span className="text-xs text-muted-foreground">·</span>
          <button onClick={dismissAllOverdue} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Dismiss
          </button>
        </div>
      )}

      {/* 7-day strip */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigate(-1)}
              disabled={weekOffset <= -21}
              className="p-1 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors"
              title="Previous week"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => navigate(1)}
              disabled={weekOffset >= 21}
              className="p-1 rounded-md hover:bg-muted/60 disabled:opacity-30 transition-colors"
              title="Next week"
            >
              <ChevronRight size={15} />
            </button>
            {isCurrentWeek ? (
              <p className="text-sm font-semibold ml-1">Week ahead</p>
            ) : (
              <>
                <p className="text-sm font-semibold ml-1 text-muted-foreground">
                  {fmtShort(addDays(today, weekOffset))} – {fmtShort(addDays(today, weekOffset + 6))}
                </p>
                <button onClick={goToToday} className="ml-2 text-xs font-medium text-leaf hover:text-forest transition-colors">
                  Back to today
                </button>
              </>
            )}
          </div>
          {weekTotal === 0
            ? <span className="text-xs text-leaf font-medium">
                {isCurrentWeek
                  ? nextTaskOffset !== null
                    ? `Next: ${fmtShort(addDays(today, nextTaskOffset))}`
                    : "All clear ✓"
                  : isFutureWeek ? "Nothing scheduled ✓" : "Nothing missed ✓"
                }
              </span>
            : <span className="text-xs text-muted-foreground">{weekTotal} {isCurrentWeek ? "remaining" : isFutureWeek ? "upcoming" : "missed"}</span>
          }
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map(({ i, actualOffset, isPast, isToday, dayLabel, dateNum, monthLabel, count }) => {
            const isSelected = selectedDay === i;
            const clickable  = count > 0 || isToday;
            return (
              <button
                key={i}
                onClick={() => clickable ? setSelectedDay(isSelected ? null : i) : undefined}
                disabled={!clickable}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 px-0.5 transition-colors",
                  isToday && !isSelected && "bg-muted/60",
                  isSelected && "bg-leaf/10 ring-1 ring-leaf/40",
                  clickable && !isSelected && "hover:bg-muted/40 cursor-pointer",
                  !clickable && "cursor-default opacity-50"
                )}
              >
                <span className={cn("text-[10px] font-medium", isToday || isSelected ? "text-foreground" : isPast ? "text-muted-foreground/70" : "text-muted-foreground")}>
                  {isToday ? "Today" : dayLabel}
                </span>
                <span className={cn("text-[11px]", isPast ? "text-muted-foreground/60" : "text-muted-foreground")}>{monthLabel} {dateNum}</span>
                {count > 0 ? (
                  <span className={cn("text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center",
                    isSelected ? "bg-leaf text-white"
                    : isPast    ? "bg-amber-500 text-white"
                    : isToday   ? "bg-amber-500 text-white"
                    : "bg-leaf text-white"
                  )}>
                    {count}
                  </span>
                ) : (
                  <span className="text-[11px] text-muted-foreground/25 leading-6">—</span>
                )}
                {clickable && (
                  <ChevronDown size={10} className={cn("text-muted-foreground/50 transition-transform", isSelected && "rotate-180")} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notes dialog — shown after single task log with note */}
      {notesDialogEvents !== null && (
        <LogNotesDialog
          events={notesDialogEvents}
          open={notesDialogEvents !== null}
          onClose={() => setNotesDialogEvents(null)}
        />
      )}

      {/* Bulk confirm dialog — shown before logging multiple tasks */}
      {bulkConfirmState !== null && (
        <BulkConfirmDialog
          careItems={bulkConfirmState.careItems}
          reminderItems={bulkConfirmState.reminderItems}
          open={bulkConfirmState !== null}
          onClose={() => setBulkConfirmState(null)}
          confirming={bulkConfirming}
          onConfirm={async (sharedNote, individualNotes) => {
            if (!bulkConfirmState) return;
            setBulkConfirming(true);
            await performBulkLog(bulkConfirmState.careItems, bulkConfirmState.reminderItems, sharedNote, individualNotes, bulkConfirmState.date);
            setBulkConfirming(false);
            setBulkConfirmState(null);
          }}
        />
      )}

      {/* Day panel */}
      {selectedDay !== null && actualSelectedOffset !== null && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className={cn("text-sm font-semibold", actualSelectedOffset < 0 && "text-amber-700 dark:text-amber-400")}>
                {dayHeading(actualSelectedOffset)}
              </span>
              {totalActive > 0 && (
                <span className="text-xs text-muted-foreground ml-1.5">
                  · {totalActive} {actualSelectedOffset < 0 ? "missed" : `task${totalActive !== 1 ? "s" : ""}`}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasActive && (
                panelSelected.size > 0 ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setPanelSelected(new Set())}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Deselect all
                    </button>
                    <Button size="sm" variant="outline" disabled={bulkLogging}
                      onClick={() => {
                        const careKeys = [...panelSelected].filter((k) => !k.startsWith("reminder-"));
                        const selectedCareEntries = activeEntries.filter((e) => careKeys.includes(`${e.plantId}-${e.careType}`));
                        if (selectedCareEntries.length > 0) onSnooze?.(selectedCareEntries);
                      }}
                    >
                      <Moon size={12} className="mr-1" /> Snooze
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkLogging}
                      onClick={() => {
                        const careKeys = [...panelSelected].filter((k) => !k.startsWith("reminder-"));
                        const rIds = [...panelSelected].filter((k) => k.startsWith("reminder-")).map((k) => k.slice(9));
                        setBulkConfirmState({
                          careItems: activeEntries.filter((e) => careKeys.includes(`${e.plantId}-${e.careType}`)),
                          reminderItems: showDayTabs ? [] : dayReminders.filter((r) => rIds.includes(r.id)),
                          date: logDate,
                        });
                      }}
                    >
                      {`Log selected (${panelSelected.size})`}
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" disabled={bulkLogging} className="shrink-0"
                    onClick={() => setBulkConfirmState({ careItems: activeEntries, reminderItems: showDayTabs ? [] : dayReminders, date: logDate })}
                  >
                    Log all
                  </Button>
                )
              )}
            </div>
          </div>

          {showDayTabs && (
            <div className="flex gap-0.5 p-0.5 bg-muted/40 rounded-lg w-fit">
              {(["overdue", "due"] as const).map((tab) => {
                const count = tab === "overdue" ? overdueEntries.length : dueTodayEntries.length;
                const label = tab === "overdue" ? "Overdue" : "Due today";
                return (
                  <button
                    key={tab}
                    onClick={() => { setDayTab(tab); setPanelSelected(new Set()); }}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      dayTab === tab
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {label} <span className={cn("ml-0.5", dayTab === tab && tab === "overdue" ? "text-red-500" : "")}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {hasActive ? (
            <div className="space-y-1.5">
              {(() => {
                // Group entries by plantId (preserve first-appearance order)
                const grouped = activeEntries.reduce<{ plantId: string; entries: CareEntry[] }[]>((acc, e) => {
                  const g = acc.find((x) => x.plantId === e.plantId);
                  if (g) g.entries.push(e); else acc.push({ plantId: e.plantId, entries: [e] });
                  return acc;
                }, []);
                return grouped.map(({ plantId, entries: group }) => {
                  if (group.length === 1) {
                    const e = group[0];
                    const key = `${e.plantId}-${e.careType}`;
                    return (
                      <DayTaskRow key={key} entry={e} logDate={logDate}
                        selected={panelSelected.has(key)}
                        isToday={actualSelectedOffset === 0}
                        onToggle={() => togglePanel(key)}
                        onLog={(eventId, withNote) => handleLog(e.plantId, e.careType, eventId, withNote)}
                        onEditSchedule={onEditSchedule ? () => onEditSchedule(e.plantId) : undefined}
                        onViewHistory={onViewHistory ? () => onViewHistory(e.plantId) : undefined} />
                    );
                  }
                  return (
                    <div key={plantId} className="rounded-lg border bg-background overflow-hidden">
                      <PlantGroupHeader
                        entry={group[0]}
                        allSelected={group.every((e) => panelSelected.has(`${e.plantId}-${e.careType}`))}
                        onToggleAll={() => {
                          const keys = group.map((e) => `${e.plantId}-${e.careType}`);
                          const allChecked = keys.every((k) => panelSelected.has(k));
                          setPanelSelected((prev) => {
                            const next = new Set(prev);
                            if (allChecked) keys.forEach((k) => next.delete(k));
                            else keys.forEach((k) => next.add(k));
                            return next;
                          });
                        }}
                        onLogAll={() => setBulkConfirmState({ careItems: group, reminderItems: [], date: logDate })}
                      />
                      <div className="divide-y">
                        {group.map((e) => {
                          const key = `${e.plantId}-${e.careType}`;
                          return (
                            <DayTaskRow key={key} entry={e} logDate={logDate}
                              selected={panelSelected.has(key)}
                              isToday={actualSelectedOffset === 0}
                              compact
                              onToggle={() => togglePanel(key)}
                              onLog={(eventId, withNote) => handleLog(e.plantId, e.careType, eventId, withNote)}
                              onEditSchedule={onEditSchedule ? () => onEditSchedule(e.plantId) : undefined}
                              onViewHistory={onViewHistory ? () => onViewHistory(e.plantId) : undefined} />
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
              {dayReminders.map((r) => (
                <DayReminderRow key={r.id} reminder={r}
                  selected={panelSelected.has(`reminder-${r.id}`)}
                  onToggle={() => togglePanel(`reminder-${r.id}`)}
                  onComplete={() => handleReminderDone(r.id)} />
              ))}
            </div>
          ) : (
            isSelectedToday && hasDone ? (
              // All done moment — all of today's tasks logged
              (() => {
                let minOffset = Infinity;
                for (const e of entries) {
                  let d = e.daysUntilDue;
                  if (d < 0) d += Math.ceil(Math.abs(d) / e.interval) * e.interval;
                  if (d > 0 && d < minOffset) minOffset = d;
                }
                for (const r of reminders) {
                  if (r.daysUntilDue > 0 && r.daysUntilDue < minOffset) minOffset = r.daysUntilDue;
                }
                const nextUpDate = minOffset < Infinity ? addDays(today, minOffset) : null;
                return (
                  <div className="text-center py-4 space-y-1">
                    <p className="text-sm font-semibold text-leaf">🌿 All done for today!</p>
                    {nextUpDate && (
                      <p className="text-xs text-muted-foreground">
                        Next up: {nextUpDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                      </p>
                    )}
                  </div>
                );
              })()
            ) : (
              !hasDone && (
                <p className="text-xs text-leaf text-center py-2">
                  {actualSelectedOffset < 0 ? "Nothing missed on this day ✓" : "Nothing scheduled for this day ✓"}
                </p>
              )
            )
          )}

          {hasDone && (
            <div className={cn("space-y-1.5", hasActive && "border-t pt-3 mt-1")}>
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Completed</p>
                {doneSelected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setDoneSelected(new Set())}
                      className="text-[11px] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Deselect all
                    </button>
                    <button
                      onClick={async () => {
                        const keys = [...doneSelected];
                        setDoneSelected(new Set());
                        for (const key of keys) {
                          const entry = doneEntryList.find((d) => `${d.plantId}-${d.careType}` === key && d.actualDay === actualSelectedOffset);
                          if (entry) await handleUnlog(entry.plantId, entry.careType, entry.logDate);
                        }
                      }}
                      className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      Undo selected ({doneSelected.size})
                    </button>
                  </div>
                )}
              </div>
              {currentDoneEntries.map((d, idx) => {
                const key = `${d.plantId}-${d.careType}`;
                return (
                  <DoneEntryRow key={`${key}-${idx}`} entry={d}
                    onUndo={() => { setDoneSelected((p) => { const n = new Set(p); n.delete(key); return n; }); handleUnlog(d.plantId, d.careType, d.logDate); }}
                    onAddNote={d.eventId ? () => setNotesDialogEvents([{ eventId: d.eventId!, plantName: d.plantName, careType: d.careType }]) : undefined}
                    selected={doneSelected.has(key)}
                    onToggle={() => setDoneSelected((p) => { const n = new Set(p); if (n.has(key)) n.delete(key); else n.add(key); return n; })}
                  />
                );
              })}
              {currentDoneReminders.map((r) => (
                <DoneReminderRow key={r.id} reminder={r} onUndo={() => handleUndoReminder(r.id)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Intervals + one-time modal ───────────────────────────────────────────────

function IntervalsModal({
  plants, onSaved, onReminderAdded, initialTab = "intervals",
}: {
  plants: PlantWithIntervals[];
  onSaved: () => void;
  onReminderAdded: (reminder: ReminderEntry) => void;
  initialTab?: "intervals" | "onetime" | "history";
}) {
  type LocalCustom = CustomSchedule & { _new?: boolean };

  type HistoryEvent = { id: string; event_type: string; event_date: string; notes: string | null };
  const [modalTab, setModalTab] = useState<"intervals" | "onetime" | "history">(initialTab);
  const [historyEvents, setHistoryEvents] = useState<HistoryEvent[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const isBulk = plants.length > 1;
  const singlePlant = !isBulk ? plants[0] : null;

  // Custom schedules (single-plant only)
  const [customList, setCustomList] = useState<LocalCustom[]>(singlePlant?.customSchedules ?? []);
  const [addingCustom, setAddingCustom] = useState(false);
  const [newCustomLabel, setNewCustomLabel] = useState("");
  const [newCustomInterval, setNewCustomInterval] = useState("");
  const [newCustomStart, setNewCustomStart] = useState(todayStr());
  const [savingCustom, setSavingCustom] = useState(false);

  async function addCustomSchedule() {
    const interval = parseInt(newCustomInterval, 10);
    if (!newCustomLabel.trim() || !interval || interval < 1 || !newCustomStart || !singlePlant) return;
    setSavingCustom(true);
    const res = await fetch("/api/garden/custom-schedules", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId: singlePlant.id, label: newCustomLabel.trim(), intervalDays: interval, startDate: newCustomStart }),
    });
    setSavingCustom(false);
    if (res.ok) {
      const { schedule } = await res.json() as { schedule: CustomSchedule };
      setCustomList((p) => [...p, schedule]);
      setNewCustomLabel(""); setNewCustomInterval(""); setNewCustomStart(todayStr());
      setAddingCustom(false);
      toast.success("Custom interval added");
      onSaved();
    } else toast.error("Failed to add custom interval");
  }

  async function deleteCustomSchedule(scheduleId: string) {
    const res = await fetch("/api/garden/custom-schedules", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduleId }),
    });
    if (res.ok) {
      setCustomList((p) => p.filter((s) => s.id !== scheduleId));
      toast.success("Custom interval removed");
      onSaved();
    } else toast.error("Failed to remove");
  }

  function loadHistory() {
    if (!singlePlant || historyLoading || historyEvents !== null) return;
    setHistoryLoading(true);
    fetch(`/api/garden/plants/${singlePlant.id}/events`)
      .then((r) => r.json() as Promise<{ events: HistoryEvent[] }>)
      .then(({ events }) => setHistoryEvents(events))
      .catch(() => setHistoryEvents([]))
      .finally(() => setHistoryLoading(false));
  }

  useEffect(() => {
    if (initialTab === "history") loadHistory();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fields = INTERVAL_FIELDS.map(({ key, emoji, label }) => ({
    key, emoji, label, meta: getFieldMeta(plants.map((p) => p[key])),
  }));

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(({ key, meta }) => [key, meta.defaultValue]))
  );
  // Leave startDate blank for plants that already have a schedule — only populate
  // it (and reset baselines) when the user explicitly picks a date, or when this
  // is a fresh plant with no intervals yet.
  const hasExistingSchedule = plants.some(
    (p) => p.waterInterval || p.fertilizeInterval || p.repotInterval || p.pruneInterval
  );
  const [startDate, setStartDate] = useState(hasExistingSchedule ? "" : todayStr());
  const [saving, setSaving] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // Ask Claude for typical intervals and pre-fill the inputs (single plant only).
  async function suggestIntervals() {
    if (!singlePlant) return;
    setSuggesting(true);
    try {
      const q = singlePlant.name.replace(/\s*—\s*/g, " ");
      const res = await fetch(`/api/garden/suggest-care?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      const s = data.suggestion;
      if (!s) { toast.error("No care suggestion found for this plant"); return; }
      setValues((p) => ({
        ...p,
        waterInterval:     String(s.water),
        fertilizeInterval: String(s.fertilize),
        repotInterval:     String(s.repot),
        pruneInterval:     String(s.prune),
      }));
      toast.success(s.confidence === "low"
        ? "Suggested a general default — double-check it, then Save"
        : "Suggested ✨ — review and Save");
    } catch {
      toast.error("Couldn't get a suggestion — please try again");
    } finally {
      setSuggesting(false);
    }
  }

  const [reminderType, setReminderType] = useState<string>("Water");
  const [reminderDate, setReminderDate] = useState(todayStr());
  const [reminderNotes, setReminderNotes] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  async function saveIntervals() {
    const body: Record<string, unknown> = { plantIds: plants.map((p) => p.id) };
    for (const { key } of INTERVAL_FIELDS) {
      const raw = values[key].trim();
      if (raw !== "") {
        const n = parseInt(raw, 10);
        if (!isNaN(n)) {
          if (n === 0) body[key] = null;     // 0 = remove this interval
          else if (n >= 1) body[key] = n;
        }
      }
    }
    if (Object.keys(body).length === 1) { toast.info("No changes to save"); return; }
    if (startDate) body.startDate = startDate;
    setSaving(true);
    const res = await fetch("/api/garden/update-intervals", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setSaving(false);
    if (res.ok) {
      toast.success(isBulk ? `Intervals updated for ${plants.length} plants` : "Intervals updated");
      onSaved();
    } else toast.error("Failed to save intervals");
  }

  async function saveReminder() {
    if (!reminderDate) { toast.info("Please pick a date"); return; }
    setSavingReminder(true);
    const res = await fetch("/api/garden/reminders", {
      method: "POST", headers: { "Content-Type": "application/json" },
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
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((scheduled.getTime() - now.getTime()) / 86400000);
      onReminderAdded({
        id: reminder.id, plantId: reminder.plant_id ?? null,
        plantName: singlePlant?.name ?? null, image: singlePlant?.image ?? null,
        eventType: reminder.event_type, scheduledDate: reminder.scheduled_date,
        notes: reminder.notes, daysUntilDue,
      });
      toast.success("Reminder added!");
      setReminderNotes(""); setReminderDate(todayStr());
    } else toast.error("Failed to add reminder");
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>{isBulk ? `Update intervals — ${plants.length} plants` : plants[0].name}</DialogTitle>
      </DialogHeader>
      {!isBulk && plants[0].image && (
        <Image src={plants[0].image} alt={plants[0].name} width={56} height={56} className="rounded-lg object-cover border w-14 h-14" />
      )}

      <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md w-fit">
        {([
          { id: "intervals", label: "Recurring" },
          { id: "onetime",   label: "One-time"  },
          ...(!isBulk ? [{ id: "history", label: "History" }] : []),
        ] as { id: "intervals" | "onetime" | "history"; label: string }[]).map((t) => (
          <button key={t.id}
            onClick={() => {
              setModalTab(t.id);
              if (t.id === "history") loadHistory();
            }}
            className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
              modalTab === t.id ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
            {t.label}
          </button>
        ))}
      </div>

      {modalTab === "intervals" && (
        <>
          {isBulk && <p className="text-xs text-muted-foreground -mt-1">Fill in a field to apply it to all {plants.length} plants. Leave blank to keep each plant&apos;s current value.</p>}
          {!isBulk && (
            <button
              onClick={suggestIntervals}
              disabled={suggesting}
              className="flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest transition-colors disabled:opacity-50"
            >
              <Sparkles size={13} />
              {suggesting ? "Suggesting…" : "Suggest a schedule with AI"}
            </button>
          )}
          <div className="grid gap-3 py-1">
            {fields.map(({ key, emoji, label, meta }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-36 shrink-0">{emoji} {label}</span>
                <Input type="number" min={0} value={values[key]} onChange={(e) => setValues((p) => ({ ...p, [key]: e.target.value }))}
                  placeholder={meta.placeholder || "—"} className="h-8 text-sm flex-1 min-w-0" />
                <span className="text-xs text-muted-foreground shrink-0">days</span>
              </div>
            ))}
            <p className="text-xs text-muted-foreground -mt-1">Enter 0 to remove an interval.</p>
            <div className="border-t pt-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-36 shrink-0">📅 First due</span>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
              </div>
              <p className="text-xs text-muted-foreground pl-[152px]">Set to re-anchor the schedule. Leave blank to keep the current rhythm.</p>
            </div>
          </div>
          {/* Custom recurring intervals — single plant only */}
          {!isBulk && (
            <div className="border-t pt-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom intervals</p>
              {customList.map((cs) => (
                <div key={cs.id} className="flex items-center gap-2 text-sm">
                  <span className="text-violet-600 dark:text-violet-400 shrink-0"><Sparkles size={13} /></span>
                  <span className="flex-1 truncate">{cs.label}</span>
                  <span className="text-xs text-muted-foreground shrink-0">every {cs.interval_days}d</span>
                  <button onClick={() => deleteCustomSchedule(cs.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 p-0.5">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {addingCustom ? (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <Input placeholder="Label (e.g. Neem oil spray)" value={newCustomLabel} onChange={(e) => setNewCustomLabel(e.target.value)} className="h-8 text-sm" />
                  <div className="flex gap-2">
                    <Input type="number" min={1} placeholder="Days" value={newCustomInterval} onChange={(e) => setNewCustomInterval(e.target.value)} className="h-8 text-sm w-24" />
                    <Input type="date" value={newCustomStart} onChange={(e) => setNewCustomStart(e.target.value)} className="h-8 text-sm flex-1" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setAddingCustom(false)} className="flex-1">Cancel</Button>
                    <Button size="sm" onClick={addCustomSchedule} disabled={savingCustom || !newCustomLabel.trim() || !newCustomInterval} className="flex-1 bg-leaf hover:bg-forest text-white">
                      {savingCustom ? "Adding…" : "Add"}
                    </Button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingCustom(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <Plus size={12} /> Add custom interval
                </button>
              )}
            </div>
          )}

          <DialogFooter showCloseButton>
            <Button
              variant="outline"
              onClick={() => {
                setValues(Object.fromEntries(INTERVAL_FIELDS.map(({ key }) => [key, "0"])));
                setStartDate(todayStr());
              }}
            >
              Remove all intervals
            </Button>
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
              <select value={reminderType} onChange={(e) => setReminderType(e.target.value)}
                className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2">
                {REMINDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-28 shrink-0">📅 Date</span>
              <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-sm text-muted-foreground">Notes</span>
              <textarea value={reminderNotes} onChange={(e) => setReminderNotes(e.target.value)}
                placeholder={reminderType === "Note" ? "What do you want to remember?" : "Optional notes…"}
                rows={3} className="text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
            </div>
          </div>
          <DialogFooter showCloseButton>
            <Button onClick={saveReminder} disabled={savingReminder} className="bg-leaf hover:bg-forest text-white">
              {savingReminder ? "Adding…" : "Add reminder"}
            </Button>
          </DialogFooter>
        </>
      )}

      {modalTab === "history" && !isBulk && (
        <div className="py-1">
          {historyLoading ? (
            <p className="text-xs text-muted-foreground text-center py-6">Loading…</p>
          ) : historyEvents && historyEvents.length > 0 ? (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyEvents.map((ev) => {
                const displayType = EVENT_TYPE_TO_DISPLAY[ev.event_type] ?? ev.event_type;
                const meta = CARE_META[displayType] ?? CARE_META["Note"];
                const dateObj = new Date(ev.event_date + "T00:00:00");
                const dateLabel = dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                return (
                  <div key={ev.id} className="flex items-start gap-2">
                    <span className="text-xs text-muted-foreground w-14 shrink-0 pt-0.5">{dateLabel}</span>
                    <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border shrink-0", meta.bg, meta.color, meta.border)}>
                      {meta.icon} {displayType}
                    </span>
                    {ev.notes && <span className="text-xs text-muted-foreground truncate">{ev.notes}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-6">No care history yet.</p>
          )}
        </div>
      )}
    </DialogContent>
  );
}

// ─── Standalone add-reminder modal ────────────────────────────────────────────

function AddReminderModal({
  plants, onAdded, onClose,
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
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plantId, eventType: DISPLAY_TO_EVENT_TYPE[reminderType] ?? "note",
        scheduledDate: reminderDate, notes: reminderNotes.trim() || null,
      }),
    });
    setSaving(false);
    if (res.ok) {
      const { reminder } = await res.json() as { reminder: { id: string; plant_id: string | null; event_type: string; scheduled_date: string; notes: string | null } };
      const plant = plants.find((p) => p.id === reminder.plant_id);
      const scheduled = new Date(reminder.scheduled_date + "T00:00:00");
      scheduled.setHours(0, 0, 0, 0);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.round((scheduled.getTime() - now.getTime()) / 86400000);
      onAdded({
        id: reminder.id, plantId: reminder.plant_id ?? null,
        plantName: plant?.name ?? null, image: plant?.image ?? null,
        eventType: reminder.event_type, scheduledDate: reminder.scheduled_date,
        notes: reminder.notes, daysUntilDue,
      });
      toast.success("Reminder added!");
      onClose();
    } else toast.error("Failed to add reminder");
  }

  return (
    <DialogContent className="sm:max-w-sm">
      <DialogHeader><DialogTitle>Add reminder</DialogTitle></DialogHeader>
      <div className="grid gap-3 py-1">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">Task type</span>
          <select value={reminderType} onChange={(e) => setReminderType(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2">
            {REMINDER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">📅 Date</span>
          <Input type="date" value={reminderDate} onChange={(e) => setReminderDate(e.target.value)} className="h-8 text-sm flex-1 min-w-0" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground w-28 shrink-0">Plant</span>
          <select value={selectedPlantId} onChange={(e) => setSelectedPlantId(e.target.value)}
            className="h-8 text-sm flex-1 min-w-0 rounded-md border border-input bg-background px-2">
            <option value="">No specific plant</option>
            {plants.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">Notes</span>
          <textarea value={reminderNotes} onChange={(e) => setReminderNotes(e.target.value)}
            placeholder={reminderType === "Note" ? "What do you want to remember?" : "Optional notes…"}
            rows={3} className="text-sm rounded-md border border-input bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-ring" />
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

// ─── Manage Schedules row ─────────────────────────────────────────────────────

const INTERVAL_TO_CARE_TYPE: Record<string, string> = {
  waterInterval: "Water", fertilizeInterval: "Fertilize",
  repotInterval: "Repot", pruneInterval: "Prune",
};

function ManagePlantRow({ plant, selectionMode, selected, onToggle, onEdit, onQuickWater, onViewHistory, dueDays, snoozedTypes, onUnsnooze }: {
  plant: PlantWithIntervals; selectionMode: boolean; selected: boolean;
  onToggle: () => void; onEdit: () => void; onQuickWater: (days: number) => void;
  onViewHistory?: () => void; dueDays?: Record<string, number>; snoozedTypes?: Set<string>;
  onUnsnooze?: (eventType: string) => void;
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
        <div className="flex items-center gap-1.5 min-w-0">
          <Link href={`/garden/${plant.id}`} className="text-sm font-medium hover:text-leaf transition-colors truncate">{plant.name}</Link>
          {plant.location && <span className="text-xs text-muted-foreground truncate shrink-0">· {plant.location}</span>}
        </div>
        {setIntervals.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2 mt-0.5">
              {setIntervals.map(({ key, emoji }) => (
                <span key={key} className="text-xs text-muted-foreground">{emoji} {plant[key]}d</span>
              ))}
            </div>
            {dueDays && Object.keys(dueDays).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-0.5">
                {setIntervals.map(({ key, emoji }) => {
                  const careType = INTERVAL_TO_CARE_TYPE[key];
                  const days = dueDays[careType];
                  if (days === undefined) return null;
                  const interval = plant[key] as number;
                  const effectiveDays = days < 0 && Math.abs(days) >= interval ? 0 : days;
                  const { label, color } = urgencyLabel(effectiveDays);
                  const isSnoozed = snoozedTypes?.has(careType);
                  return (
                    <span key={key} className={cn("text-[11px] inline-flex items-center gap-1", isSnoozed ? "text-muted-foreground/60" : color)}>
                      {emoji} {isSnoozed ? "💤 Snoozed" : label}
                      {isSnoozed && onUnsnooze && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnsnooze(DISPLAY_TO_EVENT_TYPE[careType] ?? careType.toLowerCase()); }}
                          className="hover:text-foreground transition-colors"
                          title="Clear snooze"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
                {/* Custom schedule urgency labels */}
                {plant.customSchedules?.map((cs) => {
                  const days = dueDays[cs.label];
                  if (days === undefined) return null;
                  const effectiveDays = days < 0 && Math.abs(days) >= cs.interval_days ? 0 : days;
                  const { label, color } = urgencyLabel(effectiveDays);
                  const isSnoozed = snoozedTypes?.has(cs.label);
                  return (
                    <span key={cs.id} className={cn("text-[11px] inline-flex items-center gap-1", isSnoozed ? "text-muted-foreground/60" : color)}>
                      ✨ {isSnoozed ? "💤 Snoozed" : label}
                      {isSnoozed && onUnsnooze && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnsnooze(`custom:${cs.id}`); }}
                          className="hover:text-foreground transition-colors"
                          title="Clear snooze"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {dueDays && setIntervals.some(({ key }) => dueDays[INTERVAL_TO_CARE_TYPE[key]] !== undefined) && (
              <div className="flex flex-wrap gap-2 mt-0.5">
                {setIntervals.map(({ key, emoji }) => {
                  const careType = INTERVAL_TO_CARE_TYPE[key];
                  const days = dueDays[careType];
                  if (days === undefined) return null;
                  const interval = plant[key] as number;
                  const effectiveDays = days < 0 && Math.abs(days) >= interval ? 0 : days;
                  const daysSince = interval - effectiveDays;
                  if (daysSince <= 0) return null;
                  const ago = daysSince === 1 ? "1d ago" : `${daysSince}d ago`;
                  return <span key={key} className="text-[11px] text-muted-foreground/60">{emoji} last {ago}</span>;
                })}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1 mt-0.5">
            {/* Custom-only urgency labels — plants with no built-in intervals */}
            {plant.customSchedules && plant.customSchedules.length > 0 && dueDays && (
              <div className="flex flex-wrap gap-2">
                {plant.customSchedules.map((cs) => {
                  const days = dueDays[cs.label];
                  if (days === undefined) return null;
                  const effectiveDays = days < 0 && Math.abs(days) >= cs.interval_days ? 0 : days;
                  const { label, color } = urgencyLabel(effectiveDays);
                  const isSnoozed = snoozedTypes?.has(cs.label);
                  return (
                    <span key={cs.id} className={cn("text-[11px] inline-flex items-center gap-1", isSnoozed ? "text-muted-foreground/60" : color)}>
                      ✨ {cs.label} · {isSnoozed ? "💤 Snoozed" : label}
                      {isSnoozed && onUnsnooze && (
                        <button
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUnsnooze(`custom:${cs.id}`); }}
                          className="hover:text-foreground transition-colors"
                          title="Clear snooze"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  );
                })}
              </div>
            )}
            {/* Quick water presets for plants with no water interval */}
            {!plant.waterInterval && (
              <>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[11px] text-muted-foreground mr-0.5">💧 water:</span>
                  {[3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickWater(d); }}
                      className="text-[11px] font-medium px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  + fertilize, prune, repot…
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        {onViewHistory && setIntervals.length > 0 && (
          <button onClick={onViewHistory} className="text-muted-foreground hover:text-foreground transition-colors p-0.5" title="View history">
            <Clock size={13} />
          </button>
        )}
        <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors p-0.5" title="Edit schedule">
          <Pencil size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CareScheduleClient({
  entries,
  reminderEntries: initialReminders,
  completedToday,
  plantsWithoutSchedule: _plantsWithoutSchedule,
  totalWithSchedule,
  plantIntervals,
  vacationStart: initialVacationStart,
  vacationEnd: initialVacationEnd,
  sitterToken,
}: {
  entries: CareEntry[];
  reminderEntries: ReminderEntry[];
  completedToday: CompletedCareEntry[];
  plantsWithoutSchedule: SimplePlant[];
  totalWithSchedule: number;
  plantIntervals: PlantWithIntervals[];
  vacationStart: string | null;
  vacationEnd: string | null;
  sitterToken: string | null;
}) {
  const router = useRouter();
  const [reminders, setReminders] = useState(initialReminders);
  const [activeTab, setActiveTab] = useState<"week" | "manage">("week");
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editTarget, setEditTarget] = useState<{ ids: string[]; tab: "intervals" | "onetime" | "history" } | null>(null);
  const [showAddReminder, setShowAddReminder] = useState(false);
  const editPlantIds = editTarget?.ids ?? null;

  // Snooze state
  const [snoozeDialogEntries, setSnoozeDialogEntries] = useState<CareEntry[] | null>(null);
  const [snoozeSaving, setSnoozeSaving] = useState(false);
  // Optimistic set: hides snoozed entries from the day panel before router.refresh() completes
  const [snoozedEntryKeys, setSnoozedEntryKeys] = useState<Set<string>>(new Set());

  async function handleSnooze(entries: CareEntry[], snoozedUntil: string) {
    setSnoozeSaving(true);
    const results = await Promise.all(
      entries.map((e) =>
        fetch("/api/garden/snooze", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plantId: e.plantId, eventType: e.eventKey, snoozedUntil }),
        }).then((r) => ({ ok: r.ok, entry: e }))
      )
    );
    setSnoozeSaving(false);
    const succeeded = results.filter((r) => r.ok).map((r) => r.entry);
    const failedCount = results.filter((r) => !r.ok).length;
    if (succeeded.length > 0) {
      setSnoozedEntryKeys((prev) => {
        const next = new Set(prev);
        succeeded.forEach((e) => next.add(`${e.plantId}-${e.eventKey}`));
        return next;
      });
      setSnoozeDialogEntries(null);
      const msg = succeeded.length === 1 ? "Task snoozed" : `${succeeded.length} tasks snoozed`;
      toast.success(msg, {
        action: { label: "Undo", onClick: () => handleUnsnoozeBatch(succeeded) },
      });
      router.refresh();
    }
    if (failedCount > 0) toast.error(`Failed to snooze ${failedCount} task${failedCount !== 1 ? "s" : ""}`);
  }

  async function handleUnsnoozeBatch(entries: CareEntry[]) {
    await Promise.all(entries.map((e) =>
      fetch("/api/garden/snooze", {
        method: "DELETE", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantId: e.plantId, eventType: e.eventKey }),
      })
    ));
    setSnoozedEntryKeys((prev) => {
      const next = new Set(prev);
      entries.forEach((e) => next.delete(`${e.plantId}-${e.eventKey}`));
      return next;
    });
    toast.success("Snooze cancelled");
    router.refresh();
  }

  async function handleUnsnoozeType(plantId: string, eventType: string) {
    const res = await fetch("/api/garden/snooze", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantId, eventType }),
    });
    if (res.ok) {
      setSnoozedEntryKeys((prev) => { const next = new Set(prev); next.delete(`${plantId}-${eventType}`); return next; });
      toast.success("Snooze cleared");
      router.refresh();
    }
    else toast.error("Failed to clear snooze");
  }

  // Vacation state
  const [vacationEnd, setVacationEnd] = useState(initialVacationEnd);
  const [vacationStart, setVacationStart] = useState(initialVacationStart);
  const [vacationDialogOpen, setVacationDialogOpen] = useState(false);
  const [vacationDateInput, setVacationDateInput] = useState("");
  const [vacationLoading, setVacationLoading] = useState(false);
  const [sitterDialogOpen, setSitterDialogOpen] = useState(false);
  const [sitterCopied, setSitterCopied] = useState(false);
  const isVacationActive = !!vacationEnd;

  async function handleSetVacation() {
    if (!vacationDateInput) return;
    setVacationLoading(true);
    const res = await fetch("/api/garden/vacation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vacation_end: vacationDateInput }),
    });
    setVacationLoading(false);
    if (res.ok) {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      setVacationStart(todayStr);
      setVacationEnd(vacationDateInput);
      setVacationDialogOpen(false);
      setVacationDateInput("");
      toast.success("Vacation mode on — schedules paused");
    } else {
      toast.error("Failed to set vacation mode");
    }
  }

  async function handleEndVacation() {
    setVacationLoading(true);
    const res = await fetch("/api/garden/vacation", { method: "DELETE" });
    setVacationLoading(false);
    if (res.ok) {
      setVacationStart(null);
      setVacationEnd(null);
      toast.success("Welcome back! Schedules updated.");
      router.refresh();
    } else {
      toast.error("Failed to end vacation mode");
    }
  }

  function copySitterLink() {
    const url = `${window.location.origin}/garden/care/sitter-guide?token=${sitterToken}`;
    navigator.clipboard.writeText(url).then(() => {
      setSitterCopied(true);
      setTimeout(() => setSitterCopied(false), 2000);
    });
  }

  // Manage tab filter/search
  const [manageFilter, setManageFilter] = useState<"all" | "scheduled" | "notset">("all");
  const [manageSearch, setManageSearch] = useState("");

  const intervalMap = Object.fromEntries(plantIntervals.map((p) => [p.id, p]));
  const editPlants = editPlantIds ? (editPlantIds.map((id) => intervalMap[id]).filter(Boolean) as PlantWithIntervals[]) : [];

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
    if (manageSearch.trim()) return p.name.toLowerCase().includes(manageSearch.trim().toLowerCase());
    return true;
  });

  function handleLogged(_plantId: string, _careType: string) {
    router.refresh();
  }

  function handleReminderCompleted(id: string) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  }

  function handleReminderUncompleted(reminder: ReminderEntry) {
    setReminders((prev) => [...prev, reminder].sort((a, b) => a.daysUntilDue - b.daysUntilDue));
  }

  function handleReminderAdded(reminder: ReminderEntry) {
    setReminders((prev) => [...prev, reminder].sort((a, b) => a.daysUntilDue - b.daysUntilDue));
    setEditTarget(null);
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

  function exitSelectionMode() { setSelectionMode(false); setSelected(new Set()); }

  function handleSaved() { setEditTarget(null); exitSelectionMode(); router.refresh(); }

  async function handleQuickWater(plantId: string, days: number) {
    const res = await fetch("/api/garden/update-intervals", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plantIds: [plantId], waterInterval: days }),
    });
    if (res.ok) { toast.success(`Water every ${days}d set`); router.refresh(); }
    else toast.error("Failed to set interval");
  }

  const hasAnyPlants = plantIntervals.length > 0;

  // Build map: plantId → careType → daysUntilDue (for Manage Schedules next-due display)
  const dueMap: Record<string, Record<string, number>> = {};
  // Snoozed care types per plant (for 💤 indicator in Manage Schedules)
  const snoozedMap: Record<string, Set<string>> = {};
  for (const entry of entries) {
    if (!dueMap[entry.plantId]) dueMap[entry.plantId] = {};
    dueMap[entry.plantId][entry.careType] = entry.daysUntilDue;
    if (entry.snoozeUntil) {
      if (!snoozedMap[entry.plantId]) snoozedMap[entry.plantId] = new Set();
      snoozedMap[entry.plantId].add(entry.careType);
    }
  }

  return (
    <>
      <div className="space-y-6">
        {/* Vacation banner */}
        {isVacationActive ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-lg shrink-0">🏖️</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sky-800 dark:text-sky-200">Vacation mode — schedules paused</p>
                <p className="text-xs text-sky-600 dark:text-sky-400 truncate">
                  Returns {new Date(vacationEnd! + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {vacationStart && ` · started ${new Date(vacationStart + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                </p>
              </div>
            </div>
            <button
              onClick={handleEndVacation}
              disabled={vacationLoading}
              className="text-xs font-medium text-sky-700 dark:text-sky-300 hover:text-sky-900 dark:hover:text-sky-100 whitespace-nowrap shrink-0 disabled:opacity-50 transition-colors"
            >
              {vacationLoading ? "Updating…" : "I'm back"}
            </button>
          </div>
        ) : (
          <div className="flex justify-end">
            <button
              onClick={() => setVacationDialogOpen(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              🏖️ Going away?
            </button>
          </div>
        )}

        {/* Sub-tab navigation */}
        <div className="flex gap-2 p-1 bg-muted/40 rounded-lg w-fit">
          {(["week", "manage"] as const).map((tab) => (
            <button key={tab} onClick={() => switchTab(tab)}
              className={cn("px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === tab ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab === "week" ? "Week Ahead" : "Manage Schedules"}
            </button>
          ))}
        </div>

        {/* ── WEEK AHEAD ── */}
        {activeTab === "week" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => setSitterDialogOpen(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                🌿 Share sitter guide
              </button>
              <Button size="sm" variant="outline" onClick={() => setShowAddReminder(true)} className="flex items-center gap-1.5">
                <Plus size={13} /> Add reminder
              </Button>
            </div>

            {(totalWithSchedule > 0 || reminders.length > 0) ? (
              <WeekStrip
                entries={entries}
                reminders={reminders}
                completedToday={completedToday}
                onLogged={handleLogged}
                onReminderCompleted={handleReminderCompleted}
                onReminderUncompleted={handleReminderUncompleted}
                onEditSchedule={(plantId) => setEditTarget({ ids: [plantId], tab: "intervals" })}
                onViewHistory={(plantId) => setEditTarget({ ids: [plantId], tab: "history" })}
                vacationActive={isVacationActive}
                onSnooze={(entriesToSnooze) => setSnoozeDialogEntries(entriesToSnooze)}
                snoozedEntryKeys={snoozedEntryKeys}
              />
            ) : hasAnyPlants ? (
              <div className="rounded-xl border bg-muted/30 px-5 py-6 space-y-3">
                <div className="space-y-1">
                  <p className="font-semibold text-sm">No care schedules set up yet</p>
                  <p className="text-sm text-muted-foreground">
                    Set up watering intervals so you never forget to care for your plants.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/garden/care/setup"
                    className="inline-flex items-center gap-1.5 text-sm font-medium bg-leaf hover:bg-forest text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    💧 Quick setup
                  </Link>
                  <button
                    onClick={() => switchTab("manage")}
                    className="inline-flex items-center gap-1.5 text-sm font-medium border rounded-lg px-4 py-2 hover:bg-muted/50 transition-colors"
                  >
                    Manage Schedules
                  </button>
                </div>
              </div>
            ) : (
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

        {/* ── MANAGE SCHEDULES ── */}
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
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input value={manageSearch} onChange={(e) => setManageSearch(e.target.value)}
                    placeholder="Search plants…" className="pl-8 h-9 text-sm" />
                  {manageSearch && (
                    <button onClick={() => setManageSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex gap-1 p-0.5 bg-muted/50 rounded-md">
                    {(["all", "scheduled", "notset"] as const).map((f) => {
                      const labels = { all: `All (${plantIntervals.length})`, scheduled: `Scheduled (${scheduledCount})`, notset: `Not set (${unscheduledCount})` };
                      return (
                        <button key={f} onClick={() => setManageFilter(f)}
                          className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                            manageFilter === f ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
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
                  <div className={cn("space-y-2", selectionMode && "pb-20")}>
                    {filteredPlants.map((plant) => (
                      <ManagePlantRow key={plant.id} plant={plant}
                        selectionMode={selectionMode} selected={selected.has(plant.id)}
                        onToggle={() => toggleSelect(plant.id)}
                        onEdit={() => setEditTarget({ ids: [plant.id], tab: "intervals" })}
                        onViewHistory={() => setEditTarget({ ids: [plant.id], tab: "history" })}
                        onQuickWater={(days) => handleQuickWater(plant.id, days)}
                        dueDays={dueMap[plant.id]}
                        snoozedTypes={snoozedMap[plant.id]}
                        onUnsnooze={(eventType) => handleUnsnoozeType(plant.id, eventType)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Bulk action bar — Manage Schedules only */}
      {selectionMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm shadow-lg px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted-foreground">{selected.size} plant{selected.size !== 1 ? "s" : ""} selected</p>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exitSelectionMode}>Cancel</Button>
            <Button size="sm" className="bg-leaf hover:bg-forest text-white" onClick={() => setEditTarget({ ids: [...selected], tab: "intervals" })}>
              Update intervals
            </Button>
          </div>
        </div>
      )}

      {/* Intervals modal */}
      <Dialog open={editPlantIds !== null} onOpenChange={(open: boolean) => { if (!open) setEditTarget(null); }}>
        {editPlants.length > 0 && <IntervalsModal plants={editPlants} onSaved={handleSaved} onReminderAdded={handleReminderAdded} initialTab={editTarget?.tab ?? "intervals"} />}
      </Dialog>

      {/* Add reminder modal */}
      <Dialog open={showAddReminder} onOpenChange={(open: boolean) => { if (!open) setShowAddReminder(false); }}>
        {showAddReminder && (
          <AddReminderModal
            plants={plantIntervals}
            onAdded={(r) => { handleReminderAdded(r); setShowAddReminder(false); }}
            onClose={() => setShowAddReminder(false)}
          />
        )}
      </Dialog>

      {/* Snooze dialog */}
      <Dialog open={snoozeDialogEntries !== null} onOpenChange={(open) => { if (!open) setSnoozeDialogEntries(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle><Moon size={16} className="inline mr-1.5" />Snooze {snoozeDialogEntries?.length === 1 ? "task" : `${snoozeDialogEntries?.length ?? 0} tasks`}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <p className="text-sm text-muted-foreground">Push the due date forward without logging or changing the interval.</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Tomorrow", days: 1 },
                { label: "+3 days",  days: 3 },
                { label: "+1 week",  days: 7 },
                { label: "+2 weeks", days: 14 },
              ].map(({ label, days }) => {
                const date = new Date(Date.now() + days * 86400000);
                const dateStr = date.toISOString().split("T")[0];
                return (
                  <Button key={days} variant="outline" disabled={snoozeSaving}
                    onClick={() => snoozeDialogEntries && handleSnooze(snoozeDialogEntries, dateStr)}
                    className="flex flex-col h-auto py-2.5 gap-0.5"
                  >
                    <span className="text-sm font-medium">{label}</span>
                    <span className="text-[11px] text-muted-foreground">{date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnoozeDialogEntries(null)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vacation mode dialog */}
      <Dialog open={vacationDialogOpen} onOpenChange={(open: boolean) => { if (!open) { setVacationDialogOpen(false); setVacationDateInput(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🏖️ Going away?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Set your return date and all care schedules will be paused. When you&apos;re back, due dates shift forward so nothing is overdue.
            </p>
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 border px-3 py-2.5 text-sm">
              <span className="shrink-0 mt-px">🌿</span>
              <p className="text-muted-foreground leading-snug">
                Don&apos;t forget to share your{" "}
                <button
                  onClick={() => { setVacationDialogOpen(false); setVacationDateInput(""); setSitterDialogOpen(true); }}
                  className="font-medium text-foreground underline underline-offset-2 hover:text-leaf transition-colors"
                >
                  sitter guide
                </button>
                {" "}with whoever is watching your plants.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Return date</label>
              <Input
                type="date"
                value={vacationDateInput}
                onChange={(e) => setVacationDateInput(e.target.value)}
                min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVacationDialogOpen(false); setVacationDateInput(""); }}>Cancel</Button>
            <Button
              className="bg-sky-600 hover:bg-sky-700 text-white"
              disabled={!vacationDateInput || vacationLoading}
              onClick={handleSetVacation}
            >
              {vacationLoading ? "Saving…" : "Pause schedules"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sitter guide dialog */}
      <Dialog open={sitterDialogOpen} onOpenChange={(open: boolean) => { if (!open) setSitterDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🌿 Share with your plant sitter</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-sm text-muted-foreground">
              Share this link with whoever is looking after your plants. It shows a printable day-by-day care schedule for the next 30 days — no login required.
            </p>
            {sitterToken ? (
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={typeof window !== "undefined" ? `${window.location.origin}/garden/care/sitter-guide?token=${sitterToken}` : ""}
                  className="text-xs font-mono"
                />
                <Button variant="outline" onClick={copySitterLink} className="shrink-0">
                  {sitterCopied ? <Check size={14} /> : "Copy"}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No share link available — try refreshing.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view (but not change) your care schedule.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSitterDialogOpen(false)}>Close</Button>
            {sitterToken && (
              <>
                <Button
                  variant="outline"
                  onClick={() => window.open(`/garden/care/sitter-guide?token=${sitterToken}`, "_blank")}
                >
                  View guide
                </Button>
                <Button
                  className="bg-leaf hover:bg-forest text-white"
                  onClick={() => window.open(`/garden/care/sitter-guide?token=${sitterToken}&pdf=1`, "_blank")}
                >
                  Download PDF
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
