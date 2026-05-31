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
          ? "border-[#A8BF9A] bg-[#EBF0E6] text-leaf hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:border-forest dark:bg-forest/30 dark:text-sage"
          : "border-border hover:border-sage hover:bg-[#EBF0E6] hover:text-leaf dark:hover:border-leaf dark:hover:bg-forest/30"
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
