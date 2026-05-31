"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Lock, Loader2, ExternalLink, Link2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  initialPublic: boolean;
  username?: string | null;
}

export function WishlistVisibilityToggle({ initialPublic, username }: Props) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/gardens/${username}/wishlist`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggle() {
    startTransition(async () => {
      const next = !isPublic;
      const res = await fetch("/api/garden/toggle-wishlist-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: next }),
      });
      if (!res.ok) { toast.error("Failed to update visibility"); return; }
      setIsPublic(next);
      toast.success(next ? "Wishlist is now public" : "Wishlist is now private");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={isPending}
        className={cn(
          "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors",
          isPublic
            ? "bg-[#EBF0E6] border-[#A8BF9A] text-leaf hover:bg-[#DFE7D4]"
            : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-sage"
        )}
      >
        {isPending ? (
          <Loader2 size={13} className="animate-spin" />
        ) : isPublic ? (
          <Globe size={13} />
        ) : (
          <Lock size={13} />
        )}
        {isPublic ? "Public" : "Private"}
      </button>
      {isPublic && username && (
        <a
          href={`/gardens/${username}/wishlist`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-leaf transition-colors"
          title="Preview your public wishlist"
        >
          <ExternalLink size={12} />
          Preview
        </a>
      )}
      {isPublic && username && (
        <button
          onClick={copyLink}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-leaf transition-colors"
          title="Copy wishlist link"
        >
          {copied ? <Check size={12} className="text-leaf" /> : <Link2 size={12} />}
          {copied ? "Link copied!" : "Share wishlist"}
        </button>
      )}
    </div>
  );
}
