"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function FeedUpdates({ sellerIds }: { sellerIds: string[] }) {
  const router = useRouter();
  const [newCount, setNewCount] = useState(0);
  const sellerKey = sellerIds.join(",");
  const sellerKeyRef = useRef(sellerKey);

  useEffect(() => {
    if (!sellerIds.length) return;

    const supabase = createClient();
    const filter = `seller_id=in.(${sellerKey})`;

    const channel = supabase
      .channel("feed-updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings", filter }, () => {
        setNewCount((n) => n + 1);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "auctions", filter }, () => {
        setNewCount((n) => n + 1);
      })
      .subscribe();

    sellerKeyRef.current = sellerKey;
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerKey]);

  if (!newCount) return null;

  return (
    <button
      onClick={() => { setNewCount(0); router.refresh(); }}
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-green-700 hover:bg-green-800 text-white text-sm font-medium px-5 py-2.5 rounded-full shadow-lg transition-colors whitespace-nowrap"
    >
      {newCount} new post{newCount !== 1 ? "s" : ""} — click to refresh
    </button>
  );
}
