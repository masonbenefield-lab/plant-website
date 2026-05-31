"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";

const STORAGE_KEY = "feed_explained_v1";

export function FeedExplainer() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="flex items-start gap-3 mb-6 rounded-xl border bg-[#EBF0E6] dark:bg-forest/20 border-[#C5D4BC] dark:border-forest px-4 py-3.5">
      <span className="text-xl shrink-0 mt-0.5">🌱</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-forest dark:text-[#C5D4BC]">Welcome to your feed</p>
        <p className="text-xs text-forest/70 dark:text-[#A8BF9A]/70 mt-0.5 leading-relaxed">
          Your feed shows new listings, announcements, and garden updates from sellers you follow.
          Discover sellers by browsing the{" "}
          <a href="/shop" className="underline hover:text-leaf">shop</a>{" "}
          or{" "}
          <a href="/community" className="underline hover:text-leaf">community</a>,
          then follow them from their storefront.
        </p>
      </div>
      <button onClick={dismiss} className="text-leaf/60 hover:text-leaf transition-colors shrink-0 mt-0.5">
        <X size={15} />
      </button>
    </div>
  );
}
