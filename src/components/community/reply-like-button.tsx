"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function ReplyLikeButton({
  replyId,
  initialLiked,
  initialCount,
  currentUserId,
}: {
  replyId: string;
  initialLiked: boolean;
  initialCount: number;
  currentUserId: string | null;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    if (!currentUserId) { router.push("/login"); return; }
    startTransition(async () => {
      const res = await fetch("/api/community/like-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId }),
      });
      if (res.ok) {
        const { liked: newLiked } = await res.json();
        setLiked(newLiked);
        setCount((c) => newLiked ? c + 1 : c - 1);
      }
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1 text-xs transition-colors",
        liked ? "text-red-500" : "text-muted-foreground hover:text-red-500"
      )}
    >
      <Heart size={12} className={liked ? "fill-red-500" : ""} />
      {count > 0 && <span>{count}</span>}
    </button>
  );
}
