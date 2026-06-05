"use client";

import { useEffect } from "react";

export function MarkStorefrontPreviewed() {
  useEffect(() => {
    fetch("/api/profile/mark-storefront-previewed", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
