"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WishlistButtonProps {
  userId: string | null;
  listingId?: string;
  auctionId?: string;
  initialWishlisted: boolean;
  compact?: boolean;
  className?: string;
}

export default function WishlistButton({ userId, listingId, auctionId, initialWishlisted, compact, className }: WishlistButtonProps) {
  const [wishlisted, setWishlisted] = useState(initialWishlisted);
  const [loading, setLoading] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!userId) {
      window.location.href = "/login";
      return;
    }
    setLoading(true);
    const supabase = createClient();

    if (wishlisted) {
      const query = supabase.from("wishlists").delete().eq("user_id", userId);
      const { error } = listingId
        ? await query.eq("listing_id", listingId)
        : await query.eq("auction_id", auctionId!);
      if (error) { toast.error(error.message); setLoading(false); return; }
      setWishlisted(false);
      toast.success("Removed from wishlist");
    } else {
      const { error } = await supabase.from("wishlists").insert({
        user_id: userId,
        listing_id: listingId ?? null,
        auction_id: auctionId ?? null,
      });
      if (error) { toast.error(error.message); setLoading(false); return; }
      setWishlisted(true);
      toast.success("Saved to wishlist");
    }
    setLoading(false);
  }

  if (compact) {
    return (
      <button
        onClick={toggle}
        disabled={loading}
        aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
        className={cn(
          "h-8 w-8 rounded-full flex items-center justify-center transition-colors shadow border",
          wishlisted
            ? "bg-red-500 border-red-500 text-white hover:bg-red-600"
            : "bg-background/80 border-border text-muted-foreground hover:bg-red-50 hover:text-red-500 hover:border-red-300",
          className
        )}
      >
        <Heart size={14} className={wishlisted ? "fill-current" : ""} />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "flex items-center gap-1.5 text-sm font-medium transition-colors rounded-lg px-3 py-2 border",
        wishlisted
          ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400"
          : "border-border hover:border-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-950/30"
      )}
    >
      <Heart size={16} className={wishlisted ? "fill-current" : ""} />
      {wishlisted ? "Saved" : "Save"}
    </button>
  );
}
