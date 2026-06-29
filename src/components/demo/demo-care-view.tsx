"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Droplets, Leaf, Flower2, Scissors, Sparkles, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEMO_CARE_TASKS,
  DEMO_CARE_STREAK_DAYS,
  DEMO_CARE_LOGGED_30,
  type DemoCareTask,
} from "@/lib/demo";

type CareMeta = { icon: React.ReactNode; color: string; bg: string; border: string };

const CARE_META: Record<string, CareMeta> = {
  Water:     { icon: <Droplets size={13} />, color: "text-blue-700 dark:text-blue-400",     bg: "bg-blue-100 dark:bg-blue-900/30",     border: "border-blue-200 dark:border-blue-800"     },
  Fertilize: { icon: <Leaf size={13} />,     color: "text-leaf",                            bg: "bg-[#DFE7D4] dark:bg-forest/30",      border: "border-[#C5D4BC] dark:border-forest"      },
  Repot:     { icon: <Flower2 size={13} />,  color: "text-amber-700 dark:text-amber-400",   bg: "bg-amber-100 dark:bg-amber-900/30",   border: "border-amber-200 dark:border-amber-800"   },
  Prune:     { icon: <Scissors size={13} />, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-100 dark:bg-purple-900/30", border: "border-purple-200 dark:border-purple-800" },
};

// Custom care tags (e.g. Mist, Rotate) fall back to the violet "custom" style,
// mirroring how the real care schedule renders user-defined schedules.
const CUSTOM_META: CareMeta = {
  icon: <Sparkles size={13} />,
  color: "text-violet-700 dark:text-violet-400",
  bg: "bg-violet-100 dark:bg-violet-900/30",
  border: "border-violet-200 dark:border-violet-800",
};

function getMeta(careType: string): CareMeta {
  return CARE_META[careType] ?? CUSTOM_META;
}

function urgencyLabel(days: number): { label: string; color: string } {
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "text-red-600 dark:text-red-400" };
  if (days === 0) return { label: "Due today", color: "text-amber-600 dark:text-amber-400" };
  if (days === 1) return { label: "Tomorrow", color: "text-leaf" };
  return { label: `In ${days}d`, color: "text-leaf" };
}

// Day offsets [0–6] where a recurring task falls within the visible week.
function stripDays(daysUntilDue: number, interval: number): Set<number> {
  const days = new Set<number>();
  if (daysUntilDue < 0) return days; // overdue counts toward Today only
  let d = daysUntilDue;
  while (d <= 6) { days.add(d); d += interval; }
  return days;
}

function nudge() {
  toast.info("Create a free account to track and log your own plants →", {
    action: { label: "Sign up", onClick: () => { window.location.href = "/signup"; } },
  });
}

function TaskRow({ task }: { task: DemoCareTask }) {
  const meta = getMeta(task.careType);
  const { label, color } = urgencyLabel(task.daysUntilDue);
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border bg-background">
      <div className="w-9 h-9 rounded-md bg-muted border flex items-center justify-center text-sm shrink-0">🌿</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-medium truncate">{task.plantName}</span>
          {task.location && <span className="text-[10px] text-muted-foreground truncate shrink-0">· {task.location}</span>}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn("flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full border", meta.bg, meta.color, meta.border)}>
            {meta.icon} {task.careType}
          </span>
          <span className={cn("text-[11px] font-medium", color)}>{label}</span>
        </div>
      </div>
      <button
        onClick={nudge}
        className="text-xs font-medium text-leaf hover:text-forest transition-colors whitespace-nowrap shrink-0"
      >
        Log ✓
      </button>
    </div>
  );
}

export function DemoCareView() {
  const [selectedDay, setSelectedDay] = useState(0); // 0–6 offset from today

  // Build the 7-day strip counts.
  const days = Array.from({ length: 7 }, (_, i) => {
    const count = DEMO_CARE_TASKS.reduce((sum, t) => {
      if (i === 0 && t.daysUntilDue < 0) return sum + 1; // overdue lands on Today
      return sum + (stripDays(t.daysUntilDue, t.interval).has(i) ? 1 : 0);
    }, 0);
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      i,
      isToday: i === 0,
      dayLabel: date.toLocaleDateString("en-US", { weekday: "short" }),
      monthLabel: date.toLocaleDateString("en-US", { month: "short" }),
      dateNum: date.getDate(),
      count,
    };
  });

  // Tasks for the selected day.
  const dayTasks = DEMO_CARE_TASKS.filter((t) => {
    if (selectedDay === 0 && t.daysUntilDue < 0) return true;
    return stripDays(t.daysUntilDue, t.interval).has(selectedDay);
  });
  const overdue = selectedDay === 0 ? dayTasks.filter((t) => t.daysUntilDue < 0) : [];
  const dueRest = selectedDay === 0 ? dayTasks.filter((t) => t.daysUntilDue >= 0) : dayTasks;

  const selDate = new Date();
  selDate.setDate(selDate.getDate() + selectedDay);
  const heading = selectedDay === 0
    ? "Today"
    : selectedDay === 1
      ? "Tomorrow"
      : selDate.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div className="space-y-3">
      {/* Stat strip */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm">
        <span className="font-medium">🔥 {DEMO_CARE_STREAK_DAYS}-day care streak</span>
        <span className="text-muted-foreground">{DEMO_CARE_LOGGED_30} tasks logged in the last 30 days</span>
      </div>

      {/* 7-day strip */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold">Week ahead</p>
          <span className="text-xs text-muted-foreground">
            {days.reduce((s, d) => s + d.count, 0)} task{days.reduce((s, d) => s + d.count, 0) !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isSelected = selectedDay === d.i;
            const clickable = d.count > 0 || d.isToday;
            return (
              <button
                key={d.i}
                onClick={() => clickable && setSelectedDay(d.i)}
                disabled={!clickable}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-2 px-0.5 transition-colors",
                  d.isToday && !isSelected && "bg-muted/60",
                  isSelected && "bg-leaf/10 ring-1 ring-leaf/40",
                  clickable && !isSelected && "hover:bg-muted/40 cursor-pointer",
                  !clickable && "cursor-default opacity-50",
                )}
              >
                <span className={cn("text-[10px] font-medium", d.isToday || isSelected ? "text-foreground" : "text-muted-foreground")}>
                  {d.isToday ? "Today" : d.dayLabel}
                </span>
                <span className="text-[11px] text-muted-foreground">{d.monthLabel} {d.dateNum}</span>
                {d.count > 0 ? (
                  <span className={cn(
                    "text-[11px] font-bold w-6 h-6 rounded-full flex items-center justify-center text-white",
                    isSelected ? "bg-leaf" : d.isToday ? "bg-amber-500" : "bg-leaf",
                  )}>
                    {d.count}
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

      {/* Day panel */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-semibold", overdue.length > 0 && "text-amber-700 dark:text-amber-400")}>
            {heading}
            {dayTasks.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal ml-1.5">· {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}</span>
            )}
          </span>
          {dayTasks.length > 0 && (
            <button onClick={nudge} className="text-xs font-medium text-leaf hover:text-forest transition-colors whitespace-nowrap">
              Log all
            </button>
          )}
        </div>

        {dayTasks.length === 0 ? (
          <p className="text-sm text-leaf font-medium py-2">All clear ✓</p>
        ) : (
          <div className="space-y-3">
            {overdue.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">Overdue</p>
                {overdue.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
            {dueRest.length > 0 && (
              <div className="space-y-1.5">
                {overdue.length > 0 && (
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {selectedDay === 0 ? "Due today" : "Scheduled"}
                  </p>
                )}
                {dueRest.map((t) => <TaskRow key={t.id} task={t} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Closing CTA */}
      <div className="rounded-xl border border-leaf/30 bg-[#EBF0E6] dark:bg-forest/20 px-4 py-4 text-center space-y-2">
        <p className="text-sm font-semibold text-forest dark:text-sage">Never forget to water again.</p>
        <p className="text-xs text-muted-foreground">Set a schedule once and Plantet tells you exactly what needs care, every day.</p>
        <Link href="/signup" className="inline-flex items-center justify-center rounded-md bg-leaf hover:bg-forest text-white px-4 py-2 text-sm font-medium transition-colors">
          Start my garden free →
        </Link>
      </div>
    </div>
  );
}
