"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, X, Plus, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Plant = {
  id: string;
  name: string;
  variety: string | null;
  image: string | null;
  location: string | null;
};

type PlantSelections = {
  water: number | null;
  fertilize: number | null;
  prune: number | null;
  repot: number | null;
};

const CARE_TYPES = [
  { key: "water"     as const, emoji: "💧", label: "Water every",     presets: [3, 7, 14, 30],        color: "blue"   },
  { key: "fertilize" as const, emoji: "🌿", label: "Fertilize every", presets: [14, 30, 60, 90],       color: "green"  },
  { key: "prune"     as const, emoji: "✂️", label: "Prune every",     presets: [30, 60, 90, 180],      color: "purple" },
  { key: "repot"     as const, emoji: "🪴", label: "Repot every",     presets: [180, 365],             color: "amber"  },
] as const;

const COLOR_CLASSES: Record<string, { selected: string; unselected: string }> = {
  blue:   { selected: "bg-blue-600 border-blue-600 text-white",   unselected: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40" },
  green:  { selected: "bg-leaf border-leaf text-white",            unselected: "bg-[#DFE7D4] dark:bg-forest/20 border-[#C5D4BC] dark:border-forest text-leaf hover:bg-[#C5D4BC]" },
  purple: { selected: "bg-purple-600 border-purple-600 text-white", unselected: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400 hover:bg-purple-100" },
  amber:  { selected: "bg-amber-600 border-amber-600 text-white",  unselected: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 hover:bg-amber-100" },
};

function IntervalChip({ days, selected, onClick, color }: { days: number; selected: boolean; onClick: () => void; color: string }) {
  const cls = COLOR_CLASSES[color] ?? COLOR_CLASSES.blue;
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors",
        selected ? cls.selected : cls.unselected
      )}
    >
      {selected && <Check size={10} strokeWidth={3} />}
      {days >= 365 ? "1yr" : `${days}d`}
    </button>
  );
}

export function SetupClient({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, PlantSelections>>(
    () => Object.fromEntries(plants.map((p) => [p.id, { water: null, fertilize: null, prune: null, repot: null }]))
  );
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggle(plantId: string, type: keyof PlantSelections, days: number) {
    setSelections((prev) => ({
      ...prev,
      [plantId]: { ...prev[plantId], [type]: prev[plantId][type] === days ? null : days },
    }));
  }

  function clearPlant(plantId: string) {
    setSelections((prev) => ({ ...prev, [plantId]: { water: null, fertilize: null, prune: null, repot: null } }));
  }

  function toggleExpand(plantId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId); else next.add(plantId);
      return next;
    });
  }

  const setCount = Object.values(selections).filter(
    (v) => v.water !== null || v.fertilize !== null || v.prune !== null || v.repot !== null
  ).length;

  async function finish() {
    if (setCount === 0) { router.push("/garden/care"); return; }
    setSaving(true);

    // Group plants by their full selection key to minimize API calls
    const groups = new Map<string, { plantIds: string[]; sel: PlantSelections }>();
    for (const [plantId, sel] of Object.entries(selections)) {
      if (sel.water === null && sel.fertilize === null && sel.prune === null && sel.repot === null) continue;
      const key = `${sel.water}-${sel.fertilize}-${sel.prune}-${sel.repot}`;
      if (!groups.has(key)) groups.set(key, { plantIds: [], sel });
      groups.get(key)!.plantIds.push(plantId);
    }

    let failed = false;
    for (const { plantIds, sel } of groups.values()) {
      const body: Record<string, unknown> = { plantIds };
      if (sel.water !== null)     body.waterInterval     = sel.water;
      if (sel.fertilize !== null) body.fertilizeInterval = sel.fertilize;
      if (sel.prune !== null)     body.pruneInterval     = sel.prune;
      if (sel.repot !== null)     body.repotInterval     = sel.repot;
      const res = await fetch("/api/garden/update-intervals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) { failed = true; break; }
    }

    setSaving(false);
    if (failed) { toast.error("Something went wrong — please try again"); return; }
    toast.success(setCount === 1 ? "Schedule saved for 1 plant" : `Schedules saved for ${setCount} plants`);
    router.push("/garden/care");
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Set up your care schedule</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap how often each plant needs water. Expand any plant to add fertilize, prune, or repot schedules too.
        </p>
      </div>

      <div className="space-y-3">
        {plants.map((plant) => {
          const sel = selections[plant.id];
          const isExpanded = expanded.has(plant.id);
          const hasAny = sel.water !== null || sel.fertilize !== null || sel.prune !== null || sel.repot !== null;
          const hasExtra = sel.fertilize !== null || sel.prune !== null || sel.repot !== null;

          return (
            <div
              key={plant.id}
              className={cn(
                "rounded-xl border bg-card px-4 py-3 transition-colors",
                hasAny && "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10"
              )}
            >
              <div className="flex items-center gap-3">
                {plant.image
                  ? <Image src={plant.image} alt={plant.name} width={40} height={40} className="rounded-lg object-cover border w-10 h-10 shrink-0" />
                  : <div className="w-10 h-10 rounded-lg bg-muted border flex items-center justify-center text-sm shrink-0">🌿</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {plant.variety ? `${plant.name} — ${plant.variety}` : plant.name}
                  </p>
                  {plant.location && (
                    <p className="text-xs text-muted-foreground truncate">{plant.location}</p>
                  )}
                </div>
                {hasAny && (
                  <button onClick={() => clearPlant(plant.id)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" title="Clear">
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Water row — always visible */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs text-muted-foreground mr-0.5">💧 Water every</span>
                {CARE_TYPES[0].presets.map((d) => (
                  <IntervalChip key={d} days={d} selected={sel.water === d} color="blue" onClick={() => toggle(plant.id, "water", d)} />
                ))}
              </div>

              {/* Expanded: fertilize, prune, repot */}
              {isExpanded && CARE_TYPES.slice(1).map((ct) => (
                <div key={ct.key} className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-xs text-muted-foreground mr-0.5">{ct.emoji} {ct.label}</span>
                  {ct.presets.map((d) => (
                    <IntervalChip key={d} days={d} selected={sel[ct.key] === d} color={ct.color} onClick={() => toggle(plant.id, ct.key, d)} />
                  ))}
                </div>
              ))}

              {/* Expand / collapse toggle */}
              <button
                onClick={() => toggleExpand(plant.id)}
                className="mt-2.5 flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded
                  ? <><Minus size={10} /> Less</>
                  : <><Plus size={10} /> Add fertilize, prune, repot{hasExtra ? " ✓" : ""}</>
                }
              </button>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t pt-4 pb-6 -mx-4 px-4">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <p className="text-sm text-muted-foreground">
            {setCount === 0 ? "No plants selected" : setCount === 1 ? "1 plant set up" : `${setCount} plants set up`}
          </p>
          <Button onClick={finish} disabled={saving} className="bg-leaf hover:bg-forest text-white flex items-center gap-1.5">
            {saving ? "Saving…" : setCount === 0 ? "Skip for now" : "Save & continue"}
            {!saving && <ChevronRight size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
