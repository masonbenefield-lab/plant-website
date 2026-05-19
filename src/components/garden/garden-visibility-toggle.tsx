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

export function GardenVisibilityToggle({ initialPublic, username }: Props) {
  const router = useRouter();
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  function copyLink() {
    const url = `${window.location.origin}/gardens/${username}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function toggle() {
    startTransition(async () => {
      const next = !isPublic;
      const res = await fetch("/api/garden/toggle-public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public: next }),
      });
      if (!res.ok) { toast.error("Failed to update visibility"); return; }
      setIsPublic(next);
      toast.success(next ? "Garden is now public" : "Garden is now private");
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
            ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
            : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-green-400"
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
          href={`/gardens/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-700 transition-colors"
          title="Preview your public garden"
        >
          <ExternalLink size={12} />
          Preview
        </a>
      )}
      {isPublic && username && (
        <button
          onClick={copyLink}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-green-700 transition-colors"
          title="Copy garden link"
        >
          {copied ? <Check size={12} className="text-green-600" /> : <Link2 size={12} />}
          {copied ? "Link copied!" : "Share garden"}
        </button>
      )}
    </div>
  );
}
