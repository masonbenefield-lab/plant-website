"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function AuctionActions({ auctionId }: { auctionId: string }) {
  const router = useRouter();

  async function cancelAuction() {
    if (!confirm("Cancel this auction? This cannot be undone.")) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("auctions")
      .update({ status: "cancelled" })
      .eq("id", auctionId)
      .eq("status", "active");
    if (error) toast.error(error.message);
    else {
      toast.success("Auction cancelled");
      router.refresh();
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={cancelAuction} className="text-red-600 border-red-200 hover:bg-red-50">
      Cancel
    </Button>
  );
}
