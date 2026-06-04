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
      <div className="space-y-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Monstera deliciosa — photo timeline</p>
        {[
          { date: "Jan 2024", note: "Just got it — 3 leaves, very small", color: "bg-blue-100 dark:bg-blue-900/30" },
          { date: "Mar 2024", note: "New leaf unfurling! Up to 5 leaves now", color: "bg-green-100 dark:bg-green-900/30" },
          { date: "Jun 2024", note: "8 leaves, starting to fenestrate 🎉", color: "bg-emerald-100 dark:bg-emerald-900/30" },
        ].map((p) => (
          <div key={p.date} className={`flex items-start gap-3 rounded-lg px-3 py-2.5 ${p.color}`}>
            <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-xl shrink-0">🌿</div>
            <div>
              <p className="text-xs font-semibold">{p.date}</p>
              <p className="text-xs text-muted-foreground">{p.note}</p>
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
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Fiddle Leaf Fig — upcoming care</p>
        {[
          { icon: "💧", task: "Watering",    interval: "Every 7 days",  next: "Tomorrow",  color: "text-blue-600 dark:text-blue-400" },
          { icon: "🌱", task: "Fertilizing", interval: "Every 30 days", next: "In 12 days", color: "text-green-600 dark:text-green-400" },
          { icon: "🪣", task: "Repotting",   interval: "Every 365 days",next: "In 4 months", color: "text-amber-600 dark:text-amber-400" },
          { icon: "✂️", task: "Pruning",     interval: "Every 90 days", next: "In 6 weeks",  color: "text-purple-600 dark:text-purple-400" },
        ].map((t) => (
          <div key={t.task} className="flex items-center justify-between rounded-lg border bg-card px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{t.icon}</span>
              <div>
                <p className="text-xs font-medium">{t.task}</p>
                <p className="text-[10px] text-muted-foreground">{t.interval}</p>
              </div>
            </div>
            <span className={`text-xs font-semibold ${t.color}`}>{t.next}</span>
          </div>
        ))}
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
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#DFE7D4] flex items-center justify-center text-2xl">🌿</div>
          <div>
            <p className="font-semibold text-sm">Mason&apos;s Garden</p>
            <p className="text-xs text-muted-foreground">plantet.shop/gardens/mason</p>
          </div>
        </div>
        <div className="flex gap-4 text-center border-t pt-3">
          <div className="flex-1">
            <p className="font-bold text-lg">24</p>
            <p className="text-xs text-muted-foreground">Plants</p>
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">47</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="flex-1">
            <p className="font-bold text-lg">138</p>
            <p className="text-xs text-muted-foreground">Care logs</p>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["🌿 Monstera", "🌵 Cactus mix", "🌸 Orchids", "🪴 Pothos"].map(t => (
            <span key={t} className="text-xs bg-[#DFE7D4] dark:bg-forest/40 text-leaf dark:text-sage px-2 py-0.5 rounded-full">{t}</span>
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
