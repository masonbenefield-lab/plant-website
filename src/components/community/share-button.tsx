"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

export function ShareButton({ postId }: { postId: string }) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/community/${postId}`;
    if (navigator.share) {
      try {
        await navigator.share({ url });
        return;
      } catch {
        // Fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check size={13} className="text-leaf" /> : <Share2 size={13} />}
      {copied ? "Copied!" : "Share"}
    </button>
  );
}
