"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type StateEntry = { state: string; count: number };

// [abbr, fullName, row, col] — standard US tile-grid layout
const TILES: [string, string, number, number][] = [
  ["AK", "Alaska", 0, 0],               ["HI", "Hawaii", 0, 11],
  ["ME", "Maine", 1, 10],
  ["WA", "Washington", 2, 0],   ["MT", "Montana", 2, 1],         ["ND", "North Dakota", 2, 2],
  ["MN", "Minnesota", 2, 3],    ["WI", "Wisconsin", 2, 4],
  ["VT", "Vermont", 2, 9],      ["NH", "New Hampshire", 2, 10],
  ["ID", "Idaho", 3, 0],        ["WY", "Wyoming", 3, 1],         ["SD", "South Dakota", 3, 2],
  ["IA", "Iowa", 3, 3],         ["IL", "Illinois", 3, 4],        ["MI", "Michigan", 3, 5],
  ["NY", "New York", 3, 8],     ["MA", "Massachusetts", 3, 9],
  ["OR", "Oregon", 4, 0],       ["CO", "Colorado", 4, 1],        ["NE", "Nebraska", 4, 2],
  ["MO", "Missouri", 4, 3],     ["KY", "Kentucky", 4, 4],        ["OH", "Ohio", 4, 5],
  ["WV", "West Virginia", 4, 6],["PA", "Pennsylvania", 4, 7],    ["NJ", "New Jersey", 4, 8],
  ["CT", "Connecticut", 4, 9],  ["RI", "Rhode Island", 4, 10],
  ["NV", "Nevada", 5, 0],       ["UT", "Utah", 5, 1],            ["KS", "Kansas", 5, 2],
  ["AR", "Arkansas", 5, 3],     ["TN", "Tennessee", 5, 4],       ["VA", "Virginia", 5, 5],
  ["NC", "North Carolina", 5, 6],["SC", "South Carolina", 5, 7], ["MD", "Maryland", 5, 8],
  ["DE", "Delaware", 5, 9],     ["DC", "Washington D.C.", 5, 10],
  ["CA", "California", 6, 0],   ["NM", "New Mexico", 6, 1],      ["OK", "Oklahoma", 6, 2],
  ["LA", "Louisiana", 6, 3],    ["MS", "Mississippi", 6, 4],     ["AL", "Alabama", 6, 5],
  ["GA", "Georgia", 6, 6],
  ["AZ", "Arizona", 7, 1],      ["TX", "Texas", 7, 2],           ["FL", "Florida", 7, 6],
];

const CELL = 36;
const GAP = 3;
const COLS = 12;
const ROWS = 8;

function tileColorClass(count: number, max: number): string {
  if (count === 0) return "bg-muted text-muted-foreground/40";
  const r = count / max;
  if (r > 0.75) return "bg-green-700 text-white";
  if (r > 0.5)  return "bg-green-600 text-white";
  if (r > 0.25) return "bg-green-400 text-white";
  return "bg-green-200 text-green-900 dark:bg-green-900/60 dark:text-green-100";
}

export default function BuyerMap({ states }: { states: StateEntry[] }) {
  const [open, setOpen] = useState(true);
  const [hovered, setHovered] = useState<{ abbr: string; name: string; count: number } | null>(null);

  const stateMap: Record<string, number> = {};
  for (const s of states) stateMap[s.state.toUpperCase()] = s.count;
  const max = states.length > 0 ? Math.max(...states.map(s => s.count)) : 1;

  const W = COLS * CELL + (COLS - 1) * GAP;
  const H = ROWS * CELL + (ROWS - 1) * GAP;

  return (
    <Card>
      <button
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors rounded-t-xl text-left"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Order map
          </span>
          {!open && states.length > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {states.length} state{states.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp size={16} className="text-muted-foreground" />
          : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>

      {open && (
        <CardContent className="pb-6 pt-0">
          {states.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Not enough orders to show geographic data yet — each state needs at least 5 orders to appear here.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto pb-1">
                <div
                  className="relative mx-auto"
                  style={{ width: W, height: H }}
                >
                  {TILES.map(([abbr, name, row, col]) => {
                    const count = stateMap[abbr] ?? 0;
                    const left = col * (CELL + GAP);
                    const top  = row * (CELL + GAP);
                    const colorClass = tileColorClass(count, max);
                    return (
                      <div
                        key={abbr}
                        className={`absolute flex items-center justify-center rounded text-[10px] font-bold select-none transition-transform hover:z-10 hover:scale-110 hover:ring-2 hover:ring-green-500 ${colorClass} ${count > 0 ? "cursor-pointer" : "cursor-default"}`}
                        style={{ left, top, width: CELL, height: CELL }}
                        onMouseEnter={() => count > 0 ? setHovered({ abbr, name, count }) : setHovered(null)}
                        onMouseLeave={() => setHovered(null)}
                      >
                        {abbr}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hover info strip */}
              <div className="h-5 text-center text-sm">
                {hovered ? (
                  <span>
                    <span className="font-medium">{hovered.name}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span className="font-semibold text-green-700">
                      {hovered.count} order{hovered.count !== 1 ? "s" : ""}
                    </span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">Hover a state to see details</span>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-muted-foreground">Fewer orders</span>
                <div className="flex gap-0.5">
                  {["bg-green-200", "bg-green-400", "bg-green-600", "bg-green-700"].map(c => (
                    <div key={c} className={`h-3 w-8 rounded-sm ${c}`} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">More orders</span>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
