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
    <div className="flex items-start gap-3 mb-6 rounded-xl border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 px-4 py-3.5">
      <span className="text-xl shrink-0 mt-0.5">🌱</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-green-900 dark:text-green-200">Welcome to your feed</p>
        <p className="text-xs text-green-800/70 dark:text-green-300/70 mt-0.5 leading-relaxed">
          Your feed shows new listings, announcements, and garden updates from sellers you follow.
          Discover sellers by browsing the{" "}
          <a href="/shop" className="underline hover:text-green-700">shop</a>{" "}
          or{" "}
          <a href="/community" className="underline hover:text-green-700">community</a>,
          then follow them from their storefront.
        </p>
      </div>
      <button onClick={dismiss} className="text-green-700/60 hover:text-green-700 transition-colors shrink-0 mt-0.5">
        <X size={15} />
      </button>
    </div>
  );
}
