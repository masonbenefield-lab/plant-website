"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const features = [
  {
    icon: "📸",
    title: "Photo journal",
    desc: "Add photos over time and watch your plants grow. Multiple images per plant.",
    example: (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { emoji: "🌿", name: "Pakistan Mulberry", species: "Mulberry", status: "Thriving", planted: "Planted May 2026" },
          { emoji: "🌳", name: "Viollete De Sollies", species: "Fig", status: "Growing", planted: "" },
          { emoji: "🌟", name: "Karey", species: "Starfruit", status: "Growing", planted: "" },
          { emoji: "🍌", name: "Blue Java", species: "Banana", status: "Growing", planted: "Planted Mar 2026" },
        ].map((p) => (
          <div key={p.name} className="rounded-xl border bg-card overflow-hidden">
            <div className="aspect-square bg-muted flex items-center justify-center text-4xl">{p.emoji}</div>
            <div className="p-2">
              <p className="text-xs font-semibold leading-tight truncate">{p.name}</p>
              <p className="text-[10px] text-muted-foreground">{p.species}</p>
              <span className="inline-block mt-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">{p.status}</span>
              {p.planted && <p className="text-[10px] text-muted-foreground mt-0.5">{p.planted}</p>}
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "🗓️",
    title: "Care schedule",
    desc: "Set intervals for watering, fertilizing, repotting, and pruning.",
    example: (
      <div className="space-y-3">
        {/* Week calendar */}
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold">Week ahead</p>
            <p className="text-[10px] text-muted-foreground">10 remaining</p>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {[
              { day: "Today", date: "Jun 4", count: 3 },
              { day: "Fri",   date: "Jun 5", count: 0 },
              { day: "Sat",   date: "Jun 6", count: 0 },
              { day: "Sun",   date: "Jun 7", count: 3 },
              { day: "Mon",   date: "Jun 8", count: 0 },
              { day: "Tue",   date: "Jun 9", count: 1 },
              { day: "Wed",   date: "Jun 10", count: 3 },
            ].map((d) => (
              <div key={d.date} className={`rounded-md py-1 ${d.day === "Today" ? "bg-muted" : ""}`}>
                <p className="text-[9px] text-muted-foreground">{d.day}</p>
                <p className="text-[9px] text-muted-foreground">{d.date}</p>
                {d.count > 0
                  ? <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-leaf text-white text-[9px] font-bold mt-0.5">{d.count}</span>
                  : <span className="inline-block w-4 h-4 mt-0.5 text-[9px] text-muted-foreground">—</span>
                }
              </div>
            ))}
          </div>
        </div>
        {/* Today's tasks */}
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold">Today · 3 tasks</p>
            <p className="text-[10px] text-leaf font-medium cursor-pointer">Log all</p>
          </div>
          {[
            { name: "Azores Dark Fig",  emoji: "🌳" },
            { name: "Banana — Blue Java", emoji: "🍌" },
            { name: "Black Madeira Fig", emoji: "🌿" },
          ].map((t) => (
            <div key={t.name} className="flex items-center gap-2">
              <div className="w-4 h-4 rounded border border-muted-foreground/40 shrink-0" />
              <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center text-sm shrink-0">{t.emoji}</div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{t.name}</p>
                <span className="inline-block text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">Water</span>
              </div>
              <p className="text-[10px] text-leaf font-medium shrink-0">Log ✓</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "📋",
    title: "Event log",
    desc: "Record every care event with notes. Build a full history for each plant.",
    example: (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Pothos — recent events</p>
        {[
          { icon: "💧", action: "Watered",    date: "Jun 4",  note: "Soil was very dry, gave a thorough soak" },
          { icon: "🌱", action: "Fertilized", date: "May 18", note: "Diluted liquid fertilizer, half strength" },
          { icon: "🪣", action: "Repotted",   date: "May 2",  note: "Went up one pot size, roots were circling" },
          { icon: "✂️", action: "Pruned",     date: "Apr 10", note: "Removed 3 yellowing leaves near the base" },
        ].map((e) => (
          <div key={e.date + e.action} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2">
            <span className="text-base mt-0.5">{e.icon}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium">{e.action}</p>
                <p className="text-[10px] text-muted-foreground shrink-0">{e.date}</p>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{e.note}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "🌍",
    title: "Share your garden",
    desc: "Make your garden public and share the link. Others can browse your collection.",
    example: (
      <div className="space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b">
          <div className="w-10 h-10 rounded-full bg-[#DFE7D4] flex items-center justify-center text-xl shrink-0">🌿</div>
          <div>
            <p className="text-sm font-semibold">Mason&apos;s Garden</p>
            <p className="text-[10px] text-muted-foreground">42 plants · plantet.shop/gardens/mason</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { emoji: "🌿", name: "Pakistan Mulberry", species: "Mulberry", status: "Growing" },
            { emoji: "🌳", name: "Viollete De Sollies", species: "Fig", status: "Growing" },
            { emoji: "🌟", name: "Karey", species: "Starfruit", status: "Growing" },
            { emoji: "🍌", name: "Blue Java", species: "Banana", status: "Growing" },
          ].map((p) => (
            <div key={p.name} className="rounded-xl border bg-card overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center text-3xl">{p.emoji}</div>
              <div className="p-1.5">
                <p className="text-[10px] font-semibold leading-tight truncate">{p.name}</p>
                <p className="text-[9px] text-muted-foreground">{p.species}</p>
                <span className="inline-block mt-0.5 text-[9px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full font-medium">{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "💚",
    title: "Wishlist",
    desc: "Build a list of plants you're hunting for and share it with friends.",
    example: (
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">My wishlist — 4 plants</p>
        {[
          { name: "Philodendron gloriosum",         rarity: "Rare" },
          { name: "Anthurium crystallinum",          rarity: "Uncommon" },
          { name: "Monstera thai constellation",     rarity: "Very rare" },
          { name: "Hoya kerrii variegata",           rarity: "Uncommon" },
        ].map((p) => (
          <div key={p.name} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-green-500">💚</span>
              <p className="text-xs font-medium">{p.name}</p>
            </div>
            <span className="text-[10px] text-muted-foreground">{p.rarity}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "✅",
    title: "Verified origins",
    desc: "Tag where a plant came from — if it's a Plantet seller, they can verify it publicly.",
    example: (
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Origin verification example</p>
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-[#DFE7D4] flex items-center justify-center text-xl shrink-0">🌿</div>
            <div>
              <p className="text-sm font-semibold">Monstera adansonii</p>
              <p className="text-xs text-muted-foreground">Added Jun 2024</p>
            </div>
          </div>
          <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-2 flex items-center gap-2">
            <span className="text-emerald-600 text-base">✅</span>
            <div>
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Verified Plantet purchase</p>
              <p className="text-[10px] text-muted-foreground">Purchased from @greenleaf_nursery · Verified by seller</p>
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

const COLS = 3;
const rows = [features.slice(0, COLS), features.slice(COLS)];

export default function GardenFeatureCards() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {rows.map((row, rowIdx) => {
        const expandedInRow =
          selected !== null && Math.floor(selected / COLS) === rowIdx ? selected : null;
        return (
          <div key={rowIdx} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {row.map((f, colIdx) => {
                const i = rowIdx * COLS + colIdx;
                return (
                  <button
                    key={f.title}
                    onClick={() => setSelected(selected === i ? null : i)}
                    className={cn(
                      "text-left bg-card rounded-2xl border p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-leaf/40",
                      selected === i && "border-leaf ring-1 ring-leaf shadow-md"
                    )}
                  >
                    <span className="text-2xl mb-3 block">{f.icon}</span>
                    <p className="font-semibold mb-1">{f.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    <p className={cn(
                      "text-xs mt-2 font-medium transition-colors",
                      selected === i ? "text-leaf" : "text-muted-foreground"
                    )}>
                      {selected === i ? "Hide example ↑" : "See example →"}
                    </p>
                  </button>
                );
              })}
            </div>

            {expandedInRow !== null && (
              <div className="rounded-2xl border bg-card p-5 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                <p className="text-xs font-semibold text-leaf uppercase tracking-wide mb-4">
                  {features[expandedInRow].icon} {features[expandedInRow].title} — example
                </p>
                {features[expandedInRow].example}
              </div>
            )}
          </div>
        );
      })}

      <div className="text-center mt-6">
        <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-leaf hover:bg-forest text-white font-semibold px-10")}>
          Start your garden log — it&apos;s free
        </Link>
      </div>
    </div>
  );
}
