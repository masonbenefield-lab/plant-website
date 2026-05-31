"use client";

import { useState } from "react";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Props {
  postId: string;
  initialFollowing: boolean;
  size?: "sm" | "md";
}

export function PostFollowButton({ postId, initialFollowing, size = "sm" }: Props) {
  const [following, setFollowing] = useState(initialFollowing);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const iconSize = size === "md" ? 16 : 14;

  async function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    const res = await fetch("/api/community/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId }),
    });
    if (res.status === 401) {
      router.push("/login");
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={cn(
        "rounded-lg p-1.5 transition-colors shrink-0",
        following
          ? "text-leaf bg-[#DFE7D4] dark:bg-forest/30 dark:text-sage"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
      title={following ? "Unsave post" : "Save post"}
    >
      <Bookmark size={iconSize} className={following ? "fill-current" : ""} />
    </button>
  );
}
