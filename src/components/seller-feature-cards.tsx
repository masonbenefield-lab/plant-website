"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: "🌿",
    title: "Build Your Storefront",
    href: "/signup",
    desc: "Create a personal shop page with your bio, profile photo, and all your listings in one place.",
    example: (
      <div className="space-y-3">
        {/* Seller header */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <div className="w-12 h-12 rounded-full bg-[#DFE7D4] flex items-center justify-center text-2xl shrink-0">🌿</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Gregg's Nursery</p>
            <p className="text-xs text-muted-foreground">New Braunfels, TX · 47 sales</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">Small fig and fruit tree grower. Ships same week.</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-xs text-amber-500 font-semibold">★ 4.9</p>
            <p className="text-[10px] text-muted-foreground">32 ratings</p>
          </div>
        </div>
        {/* Listings grid */}
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Active listings</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { emoji: "🌳", name: "Cravens Craving Fig", price: "$18.00" },
            { emoji: "🌿", name: "Pakistan Mulberry", price: "$24.00" },
            { emoji: "🍑", name: "Flavor King Pluot", price: "$32.00" },
          ].map((l) => (
            <div key={l.name} className="rounded-lg border bg-card overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center text-2xl">{l.emoji}</div>
              <div className="p-1.5">
                <p className="text-[10px] font-medium leading-tight truncate">{l.name}</p>
                <p className="text-[10px] text-leaf font-semibold">{l.price}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    icon: "🛒",
    title: "Sell at Fixed Price",
    href: "/shop",
    desc: "List plants with photos, variety details, and inventory count. Buyers purchase instantly.",
    example: (
      <div className="max-w-xs space-y-3">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="aspect-video bg-muted flex items-center justify-center text-5xl">🌳</div>
          <div className="p-4 space-y-2">
            <div>
              <p className="font-semibold">Cravens Craving Fig</p>
              <p className="text-xs text-muted-foreground">Fig · 4" pot · 3 in stock</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xl font-bold text-leaf">$18.00</p>
              <p className="text-xs text-muted-foreground">+ $9.00 shipping</p>
            </div>
            <div className="w-full rounded-lg bg-leaf text-white text-sm font-semibold py-2 text-center">
              Add to Cart
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Ships within 3 days · Sold by Gregg&apos;s Nursery</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⚡",
    title: "Run Live Auctions",
    href: "/auctions",
    desc: "Set a starting bid and end time. Watch live bids roll in — highest bidder wins when the clock hits zero.",
    example: (
      <div className="space-y-3">
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="relative aspect-video bg-muted flex items-center justify-center text-5xl">
            🌿
            <span className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">● LIVE</span>
            <span className="absolute top-2 right-2 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded-full">4h 22m left</span>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <p className="font-semibold">Rare Monstera Albo — Rooted Cut</p>
              <p className="text-xs text-muted-foreground">Starting bid: $45.00</p>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
              <div>
                <p className="text-[10px] text-muted-foreground">Current bid</p>
                <p className="text-xl font-bold text-leaf">$112.00</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">8 bids</p>
                <p className="text-xs font-medium">plant_lover92</p>
              </div>
            </div>
            <div className="space-y-1">
              {[
                { user: "plant_lover92", amount: "$112.00", time: "2m ago" },
                { user: "fig_fanatic",   amount: "$98.00",  time: "14m ago" },
                { user: "greenthumbs",  amount: "$75.00",  time: "31m ago" },
              ].map((b) => (
                <div key={b.time} className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{b.user}</span>
                  <span className="font-medium">{b.amount} · {b.time}</span>
                </div>
              ))}
            </div>
            <div className="w-full rounded-lg bg-leaf text-white text-sm font-semibold py-2 text-center">
              Place Bid
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "👥",
    title: "Follow Growers You Love",
    href: "/shop",
    desc: "Follow your favorite sellers and get their new listings, restocks, and updates straight in your feed.",
    example: (
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Your feed</p>
        {[
          { seller: "Gregg's Nursery",   emoji: "🌳", action: "added a new listing",   item: "Cravens Craving Fig — $18",       time: "just now",  dot: "bg-leaf" },
          { seller: "PlantsByMaria",     emoji: "🌿", action: "restocked",              item: "Monstera Thai Constellation (3 available)", time: "2h ago",    dot: "bg-blue-500" },
          { seller: "TexasFigFarm",      emoji: "📣", action: "posted an update",       item: "\"New shipment arriving Friday — check back soon!\"", time: "5h ago",    dot: "bg-amber-500" },
          { seller: "RarePlantCo",       emoji: "🌸", action: "added a new listing",   item: "Anthurium Crystallinum — $65",    time: "Yesterday", dot: "bg-leaf" },
        ].map((f) => (
          <div key={f.time + f.seller} className="flex items-start gap-2.5 rounded-lg border bg-card px-3 py-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${f.dot}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[11px]">
                <span className="font-semibold">{f.seller}</span>
                {" "}<span className="text-muted-foreground">{f.action}</span>
              </p>
              <p className="text-[10px] text-muted-foreground truncate">{f.item}</p>
            </div>
            <p className="text-[9px] text-muted-foreground shrink-0">{f.time}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "💳",
    title: "Secure Payments",
    href: "/pricing",
    desc: "Powered by Stripe. Buyers pay on-site; funds route directly to your bank minus a small platform fee.",
    example: null,
  },
  {
    icon: "🪴",
    title: "Your Personal Garden Log",
    href: "/garden",
    desc: "Track every plant you own — care schedules, growth photos, source history, and event logs all in one place.",
    example: (
      <div className="space-y-3">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Your collection — 42 plants</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { emoji: "🌳", name: "Viollete De Sollies", species: "Fig",       status: "Growing" },
            { emoji: "🌿", name: "Pakistan Mulberry",   species: "Mulberry",  status: "Thriving" },
            { emoji: "🍌", name: "Blue Java Banana",    species: "Banana",    status: "Growing" },
            { emoji: "🌟", name: "Karey Starfruit",     species: "Starfruit", status: "Growing" },
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
        <div className="rounded-lg border bg-card px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">💧</span>
            <div>
              <p className="text-[11px] font-medium">3 plants need watering today</p>
              <p className="text-[10px] text-muted-foreground">Next: Fertilize in 4 days</p>
            </div>
          </div>
          <span className="text-[10px] text-leaf font-semibold">Log all ✓</span>
        </div>
      </div>
    ),
  },
];

const COLS = 3;
const rows = [features.slice(0, COLS), features.slice(COLS)];

export default function SellerFeatureCards() {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {rows.map((row, rowIdx) => {
        const expandedInRow =
          selected !== null && Math.floor(selected / COLS) === rowIdx && features[selected].example !== null
            ? selected
            : null;

        return (
          <div key={rowIdx} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {row.map((f, colIdx) => {
                const i = rowIdx * COLS + colIdx;
                const hasExample = f.example !== null;

                if (!hasExample) {
                  return (
                    <Link
                      key={f.title}
                      href={f.href}
                      className="group rounded-2xl border bg-card p-6 hover:border-[#A8BF9A] hover:shadow-md transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-[#EBF0E6] dark:bg-forest/30 flex items-center justify-center text-2xl mb-4">
                        {f.icon}
                      </div>
                      <p className="font-semibold text-foreground mb-1.5">{f.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    </Link>
                  );
                }

                return (
                  <button
                    key={f.title}
                    onClick={() => setSelected(selected === i ? null : i)}
                    className={cn(
                      "text-left rounded-2xl border bg-card p-6 transition-all duration-200 hover:shadow-md hover:border-[#A8BF9A]",
                      selected === i && "border-leaf ring-1 ring-leaf shadow-md"
                    )}
                  >
                    <div className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center text-2xl mb-4 transition-colors",
                      selected === i ? "bg-[#DFE7D4] dark:bg-forest/50" : "bg-[#EBF0E6] dark:bg-forest/30"
                    )}>
                      {f.icon}
                    </div>
                    <p className="font-semibold text-foreground mb-1.5">{f.title}</p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                    <p className={cn(
                      "text-xs mt-3 font-medium transition-colors",
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
    </div>
  );
}
