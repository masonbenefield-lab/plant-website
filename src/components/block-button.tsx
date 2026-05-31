"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface BlockButtonProps {
  userId: string | null;
  blockedId: string;
  initialBlocked: boolean;
}

export default function BlockButton({ userId, blockedId, initialBlocked }: BlockButtonProps) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function toggle(action: "block" | "unblock") {
    if (!userId) { window.location.href = "/login"; return; }
    setLoading(true);
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId, action }),
    });
    setLoading(false);
    if (!res.ok) {
      toast.error("Something went wrong. Please try again.");
      return;
    }
    setBlocked(action === "block");
    setConfirmOpen(false);
    toast.success(action === "block" ? "User blocked." : "User unblocked.");
  }

  if (blocked) {
    return (
      <button
        onClick={() => toggle("unblock")}
        disabled={loading}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Ban size={12} />
        Unblock
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setConfirmOpen(true)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
      >
        <Ban size={12} />
        Block
      </button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Block this user?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            They won&apos;t be able to message you, bid on your auctions, or purchase your listings. You also won&apos;t see their content.
          </p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={() => toggle("block")}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Blocking…" : "Block User"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
