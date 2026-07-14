"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Share2, Loader2, Rss, Link as LinkIcon } from "lucide-react";

const WARN_HOURS = 24;

interface Props {
  plantId: string;
  plantName: string;
  username: string | null;
  isPublic: boolean;
  gardenPublic: boolean;
  lastSharedAt?: string | null;
}

export function SharePlantButton({ plantId, plantName, username, isPublic, gardenPublic, lastSharedAt }: Props) {
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

  function handleFeedShare() {
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

  async function copyLink() {
    if (!username) {
      toast.error("Set a username in your profile to share a link");
      return;
    }
    const url = `${window.location.origin}/gardens/${username}/${plantId}`;
    try {
      await navigator.clipboard.writeText(url);
      if (!gardenPublic || !isPublic) {
        toast.success("Link copied", {
          description: "Your garden or this plant is set to private, so the link won't work for visitors until you make it public.",
          duration: 8000,
        });
      } else {
        toast.success("Link copied — share it anywhere");
      }
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="outline" size="sm" disabled={isPending} className="gap-1.5" />
          }
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
          Share
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={handleFeedShare} className="gap-2">
            <Rss size={15} />
            <div className="flex flex-col">
              <span>Share to feed</span>
              <span className="text-xs text-muted-foreground">Post to your followers</span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={copyLink} className="gap-2">
            <LinkIcon size={15} />
            <div className="flex flex-col">
              <span>Copy link</span>
              <span className="text-xs text-muted-foreground">Share anywhere</span>
            </div>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
