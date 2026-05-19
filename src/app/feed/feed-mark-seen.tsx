"use client";

import { useEffect } from "react";

export function FeedMarkSeen() {
  useEffect(() => {
    fetch("/api/feed/mark-seen", { method: "POST" });
  }, []);
  return null;
}
