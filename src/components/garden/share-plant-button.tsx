"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Share2, Loader2, CheckCheck } from "lucide-react";

const WARN_HOURS = 24;

interface Props {
  plantId: string;
  plantName: string;
  isPublic: boolean;
  gardenPublic: boolean;
  lastSharedAt?: string | null;
}

export function SharePlantButton({ plantId, plantName, isPublic, gardenPublic, lastSharedAt }: Props) {
  const [shared, setShared] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function hoursAgo(iso: string) {
    return (Date.now() - new Date(iso).getTime()) / 3_600_000;
  }

  function humanAgo(iso: string) {
    const h = hoursAgo(iso);
    if (h < 1) return "less than an hour ago";
    if (h < 2) return "1 hour ago";
    return `${Math.floor(h)} hours ago`;
  }

  function handleClick() {
    if (lastSharedAt && hoursAgo(lastSharedAt) < WARN_HOURS) {
      setConfirmOpen(true);
    } else {
      doShare();
    }
  }

  function doShare() {
    setConfirmOpen(false);
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("garden_plants")
        .update({ shared_at: new Date().toISOString() })
        .eq("id", plantId);

      if (error) { toast.error("Failed to share plant"); return; }

      setShared(true);

      if (!gardenPublic || !isPublic) {
        toast.success(`${plantName} shared to your followers' feeds`, {
          description: "Note: your garden or this plant is set to private, so the link won't work for visitors until you make it public.",
          duration: 8000,
        });
      } else {
        toast.success(`${plantName} shared to your followers' feeds`);
      }
    });
  }

  if (shared) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-leaf font-medium px-3 py-1.5">
        <CheckCheck size={14} />
        Shared to feed
      </div>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={isPending} className="gap-1.5">
        {isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        Share to feed
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Already shared recently</DialogTitle>
            <DialogDescription>
              You shared <span className="font-medium text-foreground">{plantName}</span> to your feed{" "}
              {lastSharedAt ? humanAgo(lastSharedAt) : ""}. Share it again?
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1 bg-leaf hover:bg-forest" onClick={doShare} disabled={isPending}>
              {isPending ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Share anyway
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
