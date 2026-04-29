"use client";

import { useEffect, useState, useRef } from "react";
import { Leaf } from "lucide-react";

export default function PlantInfoCard({ q }: { q: string }) {
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!q || q.trim().length < 3) {
      setDescription(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setDescription(null);
      try {
        const res = await fetch(`/api/plant-info?q=${encodeURIComponent(q.trim())}`);
        const data = await res.json();
        setDescription(data.description ?? null);
      } catch {
        setDescription(null);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  if (!loading && !description) return null;

  return (
    <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800 px-4 py-3 flex gap-3 items-start mb-6">
      <div className="mt-0.5 text-green-600 dark:text-green-400 shrink-0">
        <Leaf size={16} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-green-800 dark:text-green-300 mb-1 uppercase tracking-wide">
          Plant Guide
        </p>
        {loading ? (
          <div className="space-y-1.5">
            <div className="h-3 bg-green-200 dark:bg-green-700 rounded animate-pulse w-full" />
            <div className="h-3 bg-green-200 dark:bg-green-700 rounded animate-pulse w-4/5" />
          </div>
        ) : (
          <p className="text-sm text-green-900 dark:text-green-100 leading-relaxed">{description}</p>
        )}
      </div>
    </div>
  );
}
