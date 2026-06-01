"use client";

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Leaf, X } from "lucide-react";

const STORAGE_KEY = "plantet_plant_guide_enabled";

export default function PlantInfoCard() {
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const [enabled, setEnabled] = useState(true);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Read permanent setting on mount and sync when toggled from filter bar
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === "false") setEnabled(false);
    function sync() {
      if (localStorage.getItem(STORAGE_KEY) !== "false") setEnabled(true);
    }
    window.addEventListener("plantet:plant-guide-change", sync);
    return () => window.removeEventListener("plantet:plant-guide-change", sync);
  }, []);

  // Re-enable on new search only if not permanently disabled
  useEffect(() => {
    if (q && q.trim().length >= 3) {
      if (localStorage.getItem(STORAGE_KEY) !== "false") setEnabled(true);
    }
  }, [q]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [q, enabled]);

  function dismiss() {
    setDescription(null);
    setEnabled(false);
    setConfirming(false);
  }

  function disablePermanently() {
    localStorage.setItem(STORAGE_KEY, "false");
    window.dispatchEvent(new Event("plantet:plant-guide-change"));
    dismiss();
  }

  if (!enabled) return null;
  if (!loading && !description && !confirming) return null;

  return (
    <div className="relative rounded-xl border border-[#C5D4BC] bg-[#EBF0E6] dark:bg-forest/20 dark:border-forest px-4 py-3 flex gap-3 items-start mb-6">
      <div className="mt-0.5 text-leaf dark:text-sage shrink-0">
        <Leaf size={16} />
      </div>
      <div className="flex-1 pr-6">
        <p className="text-xs font-semibold text-forest dark:text-[#A8BF9A] mb-1 uppercase tracking-wide">
          Plant Guide
        </p>
        {confirming ? (
          <div className="space-y-2">
            <p className="text-sm text-forest dark:text-[#DFE7D4]">
              This will hide the Plant Guide for all future searches on this device.
              To turn it back on, click the <Leaf size={12} className="inline mb-0.5" /> icon that will appear in the search bar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                className="text-xs px-3 py-1 rounded-md border border-forest/30 text-forest dark:text-[#A8BF9A] hover:bg-forest/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={disablePermanently}
                className="text-xs px-3 py-1 rounded-md bg-forest text-cream hover:bg-forest/80 transition-colors"
              >
                Turn off
              </button>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-1.5">
            <div className="h-3 bg-[#C5D4BC] dark:bg-leaf rounded animate-pulse w-full" />
            <div className="h-3 bg-[#C5D4BC] dark:bg-leaf rounded animate-pulse w-4/5" />
          </div>
        ) : (
          <>
            <p className="text-sm text-forest dark:text-[#DFE7D4] leading-relaxed">{description}</p>
            <button
              onClick={() => setConfirming(true)}
              className="mt-1.5 text-xs text-forest/50 dark:text-[#A8BF9A]/50 hover:text-forest/80 dark:hover:text-[#A8BF9A] transition-colors underline underline-offset-2"
            >
              Turn off Plant Guide
            </button>
          </>
        )}
      </div>
      {!confirming && (
        <button
          onClick={dismiss}
          aria-label="Hide plant guide"
          className="absolute top-2.5 right-3 text-forest/40 hover:text-forest dark:text-sage/40 dark:hover:text-sage transition-colors"
        >
          <X size={15} />
        </button>
      )}
    </div>
  );
}
