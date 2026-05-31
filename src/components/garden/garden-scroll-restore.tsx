"use client";

import { useLayoutEffect, useEffect } from "react";

const KEY = "garden-scroll-y";

export function GardenScrollRestore() {
  // Restore before the browser paints to avoid a visible jump
  useLayoutEffect(() => {
    const saved = sessionStorage.getItem(KEY);
    if (saved) {
      window.scrollTo({ top: parseInt(saved, 10), behavior: "instant" });
    }
  }, []);

  // Continuously save scroll position while on this page
  useEffect(() => {
    const save = () => sessionStorage.setItem(KEY, String(Math.round(window.scrollY)));
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, []);

  return null;
}
