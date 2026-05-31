"use client";

import { useEffect } from "react";

const KEY = "garden-scroll-y";

export function GardenScrollRestore() {
  useEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      const pos = parseInt(saved, 10);
      // Double rAF: first frame lets React finish committing, second lets
      // Next.js apply its own scroll management — we then override it.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.scrollTo({ top: pos, behavior: "instant" });
        });
      });
    }

    const save = () => sessionStorage.setItem(KEY, String(Math.round(window.scrollY)));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

  return null;
}
