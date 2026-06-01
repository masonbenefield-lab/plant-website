"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Slide = {
  id: string;
  badge: string;
  heading: string;
  tagline: string;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  accent: string;
  href: string;
  cta: string;
};

const CATEGORY_SLIDES: Slide[] = [
  {
    id: "aroids",
    badge: "Category",
    heading: "Aroids",
    tagline: "Monsteras, philodendrons & rare collectors' finds",
    emoji: "🌿",
    gradientFrom: "#1a3d2c",
    gradientTo: "#2d6b4a",
    accent: "#A8C19A",
    href: "/shop?category=Aroids",
    cta: "Browse Aroids",
  },
  {
    id: "rare",
    badge: "Category",
    heading: "Rare & Exotic",
    tagline: "One-of-a-kind specimens for serious collectors",
    emoji: "✨",
    gradientFrom: "#2e1065",
    gradientTo: "#6d28d9",
    accent: "#c4b5fd",
    href: "/shop?category=Rare+%26+Exotic",
    cta: "Browse Rare Plants",
  },
  {
    id: "orchids",
    badge: "Category",
    heading: "Orchids",
    tagline: "Elegant blooms from tropical regions worldwide",
    emoji: "🌸",
    gradientFrom: "#4c0519",
    gradientTo: "#be185d",
    accent: "#fda4af",
    href: "/shop?category=Orchids",
    cta: "Browse Orchids",
  },
  {
    id: "succulents",
    badge: "Category",
    heading: "Succulents & Cacti",
    tagline: "Hardy beauties that thrive with minimal care",
    emoji: "🌵",
    gradientFrom: "#451a03",
    gradientTo: "#b45309",
    accent: "#fcd34d",
    href: "/shop?category=Succulents+%26+Cacti",
    cta: "Browse Succulents",
  },
];

const PROMO_SLIDES: Slide[] = [
  {
    id: "garden-log",
    badge: "Free for everyone",
    heading: "Your Garden Log",
    tagline: "Track every plant you own. Care schedules, photos & history — free forever.",
    emoji: "🪴",
    gradientFrom: "#1F4736",
    gradientTo: "#2F7D54",
    accent: "#DFE7D4",
    href: "/garden",
    cta: "Start your garden log",
  },
  {
    id: "sell",
    badge: "For sellers",
    heading: "List Your Plants",
    tagline: "No listing fees. No monthly charges. We only earn when you do.",
    emoji: "🌱",
    gradientFrom: "#7c2d12",
    gradientTo: "#c2410c",
    accent: "#fed7aa",
    href: "/signup",
    cta: "Create free account",
  },
];

const GIVEAWAY_SLIDE: Slide = {
  id: "giveaway",
  badge: "This month only",
  heading: "Win a Free Plant",
  tagline: "Every month we give away a rare plant. Enter free — no purchase needed.",
  emoji: "🎁",
  gradientFrom: "#1e3a5f",
  gradientTo: "#1d4ed8",
  accent: "#93c5fd",
  href: "/giveaway",
  cta: "Enter the giveaway",
};

const INTERVAL_MS = 4000;

export function HeroCategoryCarousel({ hasActiveGiveaway }: { hasActiveGiveaway: boolean }) {
  const slides: Slide[] = [
    CATEGORY_SLIDES[0],       // Aroids
    PROMO_SLIDES[0],          // Garden Log
    CATEGORY_SLIDES[1],       // Rare & Exotic
    ...(hasActiveGiveaway ? [GIVEAWAY_SLIDE] : []),
    CATEGORY_SLIDES[2],       // Orchids
    PROMO_SLIDES[1],          // List Your Plants
    CATEGORY_SLIDES[3],       // Succulents & Cacti
  ];

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = useCallback((dir: 1 | -1) => {
    setCurrent((c) => (c + dir + slides.length) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused) return;
    timerRef.current = setTimeout(() => go(1), INTERVAL_MS);
    return () => clearTimeout(timerRef.current);
  }, [current, paused, go]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) go(diff > 0 ? 1 : -1);
    touchStartX.current = null;
  }

  return (
    <div
      className="flex flex-col gap-3 select-none"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Track */}
      <div
        className="relative h-[300px] sm:h-[360px] overflow-hidden rounded-2xl"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, i) => {
          const offset = ((i - current) % slides.length + slides.length) % slides.length;
          // 0 = current, 1 = next (peeks right), rest = hidden right
          const isVisible = offset === 0 || offset === 1;
          const isPrev = offset === slides.length - 1;

          return (
            <div
              key={slide.id}
              className="absolute inset-y-0 rounded-2xl overflow-hidden transition-all duration-500 ease-in-out"
              style={{
                width: "87%",
                left: offset === 0
                  ? "0%"
                  : offset === 1
                  ? "calc(87% + 12px)"
                  : isPrev
                  ? "calc(-87% - 12px)"
                  : "calc(87% + 12px)",
                opacity: isVisible || isPrev ? 1 : 0,
                background: `linear-gradient(145deg, ${slide.gradientFrom}, ${slide.gradientTo})`,
              }}
            >
              {/* Decorative circles */}
              <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full bg-white/5" />
              <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-white/5" />

              <div className="relative h-full flex flex-col p-6">
                {/* Badge */}
                <span
                  className="self-start text-[11px] font-semibold uppercase tracking-widest px-2.5 py-1 rounded-full bg-white/20 mb-auto"
                  style={{ color: slide.accent }}
                >
                  {slide.badge}
                </span>

                {/* Emoji */}
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-7xl sm:text-8xl drop-shadow-lg">{slide.emoji}</span>
                </div>

                {/* Text + CTA */}
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-widest mb-1" style={{ color: slide.accent }}>
                    {slide.heading}
                  </p>
                  <p className="text-white/80 text-sm leading-snug mb-3 line-clamp-2">{slide.tagline}</p>
                  <Link
                    href={slide.href}
                    className="inline-block text-sm font-semibold px-4 py-2 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                  >
                    {slide.cta} →
                  </Link>
                </div>
              </div>
            </div>
          );
        })}

        {/* Right-edge gradient to hint at the peek */}
        <div className="absolute inset-y-0 right-0 w-[13%] bg-gradient-to-l from-[#19392B]/60 to-transparent pointer-events-none rounded-r-2xl" />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-1">
        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={cn(
                "rounded-full transition-all duration-300",
                i === current
                  ? "w-5 h-1.5 bg-white"
                  : "w-1.5 h-1.5 bg-white/40 hover:bg-white/60"
              )}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => go(-1)}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            aria-label="Previous"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={() => go(1)}
            className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors"
            aria-label="Next"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
