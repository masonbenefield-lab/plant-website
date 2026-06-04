"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Plant = {
  id: string;
  name: string;
  variety: string | null;
  image: string | null;
  location: string | null;
};

const WATER_PRESETS = [3, 7, 14, 30] as const;

function IntervalChip({ days, selected, onClick }: { days: number; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full border transition-colors",
        selected
          ? "bg-blue-600 border-blue-600 text-white"
          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40"
      )}
    >
      {selected && <Check size={10} strokeWidth={3} />}
      {days}d
    </button>
  );
}

export function SetupClient({ plants }: { plants: Plant[] }) {
  const router = useRouter();
  const [selections, setSelections] = useState<Record<string, number | null>>(
    () => Object.fromEntries(plants.map((p) => [p.id, null]))
  );
  const [saving, setSaving] = useState(false);

  function toggle(plantId: string, days: number) {
    setSelections((prev) => ({
      ...prev,
      [plantId]: prev[plantId] === days ? null : days,
    }));
  }

  function skip(plantId: string) {
    setSelections((prev) => ({ ...prev, [plantId]: null }));
  }

  const setCount = Object.values(selections).filter((v) => v !== null).length;

  async function finish() {
    if (setCount === 0) {
      router.push("/garden/care");
      return;
    }
    setSaving(true);

    // Group plants by selected interval to minimise API calls
    const groups = new Map<number, string[]>();
    for (const [plantId, days] of Object.entries(selections)) {
      if (days !== null) {
        if (!groups.has(days)) groups.set(days, []);
        groups.get(days)!.push(plantId);
      }
    }

    let failed = false;
    for (const [days, ids] of groups) {
      const res = await fetch("/api/garden/update-intervals", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantIds: ids, waterInterval: days }),
      });
      if (!res.ok) { failed = true; break; }
    }

    setSaving(false);
    if (failed) {
      toast.error("Something went wrong — please try again");
      return;
    }
    toast.success(
      setCount === 1
        ? "Schedule saved for 1 plant"
        : `Schedules saved for ${setCount} plants`
    );
    router.push("/garden/care");
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold">Set up your watering schedule</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Tap how often each plant needs water. Skip any you&apos;re not sure about — you can always add more detail later in Manage Schedules.
        </p>
      </div>

      {/* Plant cards */}
      <div className="space-y-3">
        {plants.map((plant) => {
          const selected = selections[plant.id];
          const isSet = selected !== null;
          return (
            <div
              key={plant.id}
              className={cn(
                "rounded-xl border bg-card px-4 py-3 transition-colors",
                isSet && "border-blue-300 dark:border-blue-700 bg-blue-50/30 dark:bg-blue-900/10"
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
                {isSet && (
                  <button
                    onClick={() => skip(plant.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="Clear"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="text-xs text-muted-foreground mr-0.5">💧 Water every</span>
                {WATER_PRESETS.map((d) => (
                  <IntervalChip
                    key={d}
                    days={d}
                    selected={selected === d}
                    onClick={() => toggle(plant.id, d)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t pt-4 pb-6 -mx-4 px-4">
        <div className="flex items-center justify-between gap-4 max-w-lg mx-auto">
          <p className="text-sm text-muted-foreground">
            {setCount === 0
              ? "No plants selected"
              : setCount === 1
                ? "1 plant set up"
                : `${setCount} plants set up`
            }
          </p>
          <Button
            onClick={finish}
            disabled={saving}
            className="bg-leaf hover:bg-forest text-white flex items-center gap-1.5"
          >
            {saving ? "Saving…" : setCount === 0 ? "Skip for now" : "Save & continue"}
            {!saving && <ChevronRight size={15} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
