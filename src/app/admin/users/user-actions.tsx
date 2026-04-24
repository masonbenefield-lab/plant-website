"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export function DeleteUserButton({ userId, username, isAdmin }: { userId: string; username: string; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isAdmin) {
    return <span className="text-xs text-muted-foreground italic">Admin — protected</span>;
  }

  async function handleDelete() {
    setLoading(true);
    const supabase = createClient();

    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) { toast.error(error.message); setLoading(false); return; }

    // Pause active listings and cancel active auctions
    await Promise.all([
      supabase.from("listings").update({ status: "paused" }).eq("seller_id", userId).eq("status", "active"),
      supabase.from("auctions").update({ status: "cancelled" }).eq("seller_id", userId).eq("status", "active"),
    ]);

    toast.success(`${username} archived — 30 days until permanent deletion`);
    setOpen(false);
    setLoading(false);
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
            <DialogTitle>Archive user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{username}</strong> will be archived for 30 days. Their active listings will be paused and live auctions cancelled. You can restore them any time before the 30 days are up.
          </p>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading} className="flex-1">
              {loading ? "Archiving…" : "Archive User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function RestoreUserButton({ userId, username }: { userId: string; username: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleRestore() {
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: null })
      .eq("id", userId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${username} restored`);
    router.refresh();
  }

  return (
    <button onClick={handleRestore} disabled={loading} className="text-xs text-green-700 hover:underline font-medium disabled:opacity-50">
      {loading ? "Restoring…" : "Restore"}
    </button>
  );
}
