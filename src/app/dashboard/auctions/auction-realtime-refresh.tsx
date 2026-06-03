"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AuctionRealtimeRefresh({ sellerId }: { sellerId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`dashboard-auctions:${sellerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "auctions",
          filter: `seller_id=eq.${sellerId}`,
        },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sellerId, router]);

  return null;
}
