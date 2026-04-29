"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

async function auditLog(
  supabase: ReturnType<typeof createClient>,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  notes?: string
) {
  await supabase.from("admin_audit_logs").insert({
    admin_id: adminId,
    action,
    target_type: targetType,
    target_id: targetId,
    notes: notes ?? null,
  });
}

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
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("profiles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", userId);

    if (error) { toast.error(error.message); setLoading(false); return; }

    await Promise.all([
      supabase.from("listings").update({ status: "paused" }).eq("seller_id", userId).eq("status", "active"),
      supabase.from("auctions").update({ status: "cancelled" }).eq("seller_id", userId).eq("status", "active"),
    ]);

    if (user) await auditLog(supabase, user.id, "archive_user", "user", userId, username);

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
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("profiles").update({ deleted_at: null }).eq("id", userId);
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    if (user) await auditLog(supabase, user.id, "restore_user", "user", userId, username);
    toast.success(`${username} restored`);
    router.refresh();
  }

  return (
    <button onClick={handleRestore} disabled={loading} className="text-xs text-green-700 hover:underline font-medium disabled:opacity-50">
      {loading ? "Restoring…" : "Restore"}
    </button>
  );
}

export function RenameUserButton({ userId, username, isAdmin }: { userId: string; username: string; isAdmin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState(username);
  const [loading, setLoading] = useState(false);

  if (isAdmin) return null;

  async function handleRename() {
    const trimmed = newName.trim().toLowerCase();
    if (!trimmed || trimmed === username) { setOpen(false); return; }
    setLoading(true);
    const res = await fetch("/api/admin/rename-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: userId, newUsername: trimmed }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success(`Renamed to ${trimmed}`);
      setOpen(false);
      router.refresh();
    }
  }

  return (
    <>
      <button onClick={() => { setNewName(username); setOpen(true); }} className="text-xs text-blue-600 hover:underline font-medium">
        Rename
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename user</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-3">
            Changing the username for <strong>{username}</strong>. This will also change their storefront URL.
          </p>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
            placeholder="new-username"
            minLength={3}
            maxLength={30}
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") handleRename(); }}
          />
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleRename} disabled={loading || !newName.trim() || newName.trim() === username} className="flex-1 bg-blue-600 hover:bg-blue-700">
              {loading ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
