"use client";

import { useState } from "react";
import { UserPlus, UserCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FollowButtonProps {
  userId: string | null;
  sellerId: string;
  initialFollowing: boolean;
  initialCount: number;
}

export default function FollowButton({ userId, sellerId, initialFollowing, initialCount }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    if (userId === sellerId) return;
    setLoading(true);
    const supabase = createClient();

    if (following) {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", userId)
        .eq("seller_id", sellerId);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setFollowing(false);
      setCount((c) => Math.max(0, c - 1));
    } else {
      const { error } = await supabase
        .from("follows")
        .insert({ follower_id: userId, seller_id: sellerId });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setFollowing(true);
      setCount((c) => c + 1);
      toast.success("Following seller");
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || userId === sellerId}
      className={cn(
        "flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors",
        following
          ? "border-green-300 bg-green-50 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:border-green-800 dark:bg-green-950/30 dark:text-green-400"
          : "border-border hover:border-green-400 hover:bg-green-50 hover:text-green-700 dark:hover:border-green-700 dark:hover:bg-green-950/30"
      )}
    >
      {following ? <UserCheck size={16} /> : <UserPlus size={16} />}
      {following ? "Following" : "Follow"}
      {count > 0 && (
        <span className="ml-0.5 text-xs text-muted-foreground">{count}</span>
      )}
    </button>
  );
}
