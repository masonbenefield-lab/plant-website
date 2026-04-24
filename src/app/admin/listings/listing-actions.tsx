"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeleteListingButton({ listingId, plantName }: { listingId: string; plantName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.from("listings").delete().eq("id", listingId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
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
            <DialogTitle>Delete listing?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Permanently delete <strong>{plantName}</strong>. This cannot be undone.
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

export function PauseListingButton({ listingId, currentStatus }: { listingId: string; currentStatus: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isPaused = currentStatus === "paused";

  async function toggle() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({ status: isPaused ? "active" : "paused" })
      .eq("id", listingId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(isPaused ? "Listing restored" : "Listing paused");
    router.refresh();
  }

  return (
    <button onClick={toggle} disabled={loading} className="text-xs text-yellow-600 hover:underline font-medium disabled:opacity-50">
      {loading ? "…" : isPaused ? "Restore" : "Pause"}
    </button>
  );
}
