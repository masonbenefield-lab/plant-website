"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function CancelAuctionButton({ auctionId, plantName, currentStatus }: { auctionId: string; plantName: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isCancelled = currentStatus === "cancelled";

  async function handleCancel() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("auctions")
      .update({ status: "cancelled" })
      .eq("id", auctionId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Auction cancelled: ${plantName}`);
    router.refresh();
  }

  if (isCancelled) return <span className="text-xs text-muted-foreground">Cancelled</span>;

  return (
    <button onClick={handleCancel} disabled={loading} className="text-xs text-yellow-600 hover:underline font-medium disabled:opacity-50">
      {loading ? "…" : "Cancel"}
    </button>
  );
}

export function DeleteAuctionButton({ auctionId, plantName }: { auctionId: string; plantName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("auctions").delete().eq("id", auctionId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Auction deleted");
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-xs text-red-600 hover:underline font-medium">
        Delete
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete auction?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete the auction for <strong>{plantName}</strong>. All bids will also be removed. This cannot be undone.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading} className="flex-1">
              {loading ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
