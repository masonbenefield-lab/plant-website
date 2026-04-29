"use client";

import { useState } from "react";
import { Share2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ShareButtonProps {
  username: string;
}

export default function ShareButton({ username }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = `${window.location.origin}/sellers/${username}`;
    const shareData = {
      title: `${username}'s Plant Store — Plantet`,
      text: `Check out ${username}'s plant store on Plantet!`,
      url,
    };

    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }

    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
      {copied ? (
        <>
          <Check size={14} className="text-green-600" />
          <span className="text-green-600">Copied!</span>
        </>
      ) : (
        <>
          <Share2 size={14} />
          Share
        </>
      )}
    </Button>
  );
}
