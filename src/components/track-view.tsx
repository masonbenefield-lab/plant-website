"use client";

import { useEffect } from "react";

const MAX_RECENT = 6;
const STORAGE_KEY = "recently_viewed_listings";

export function saveRecentlyViewed(id: string) {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const ids: string[] = stored ? JSON.parse(stored) : [];
    const next = [id, ...ids.filter((x) => x !== id)].slice(0, MAX_RECENT);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch { /* localStorage unavailable */ }
}

export function getRecentlyViewed(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export default function TrackView({ listingId }: { listingId: string }) {
  useEffect(() => {
    saveRecentlyViewed(listingId);
  }, [listingId]);
  return null;
}
