"use client";

import { useEffect, useState, useRef } from "react";
import { TrendingUp } from "lucide-react";

interface Suggestion {
  min: number;
  max: number;
  median: number;
  count: number;
  matchType: "variety" | "name";
}

interface Props {
  plantName: string;
  variety: string;
  /** "price" for listings, "bid" for auctions */
  label?: string;
}

function cents(n: number) {
  return `$${(n / 100).toFixed(2).replace(/\.00$/, "")}`;
}

export default function PriceSuggestion({ plantName, variety, label = "price" }: Props) {
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setSuggestion(null);

    if (plantName.trim().length < 2) return;

    timerRef.current = setTimeout(async () => {
      const params = new URLSearchParams({ plant: plantName.trim() });
      if (variety.trim().length >= 2) params.set("variety", variety.trim());

      try {
        const res = await fetch(`/api/price-suggestion?${params}`);
        const json = await res.json();
        setSuggestion(json.suggestion ?? null);
      } catch {
        // silently ignore — suggestion is non-critical
      }
    }, 500);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plantName, variety]);

  if (!suggestion) return null;

  const matchLabel =
    suggestion.matchType === "variety" && variety.trim()
      ? `${plantName} — ${variety}`
      : plantName;

  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
      <TrendingUp size={12} className="shrink-0 text-green-600" />
      Based on{" "}
      <span className="font-medium text-foreground">
        {suggestion.count} similar listing{suggestion.count !== 1 ? "s" : ""}
      </span>{" "}
      of <span className="italic">{matchLabel}</span>: suggested {label} range{" "}
      <span className="font-medium text-foreground">
        {cents(suggestion.min)} – {cents(suggestion.max)}
      </span>
      , typical{" "}
      <span className="font-medium text-green-700">{cents(suggestion.median)}</span>
    </p>
  );
}
