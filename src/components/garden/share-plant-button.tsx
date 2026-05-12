"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Share2, Loader2, CheckCheck } from "lucide-react";

interface Props {
  plantId: string;
  plantName: string;
  isPublic: boolean;
  gardenPublic: boolean;
}

export function SharePlantButton({ plantId, plantName, isPublic, gardenPublic }: Props) {
  const [shared, setShared] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleShare() {
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
      <div className="flex items-center gap-1.5 text-sm text-green-700 font-medium px-3 py-1.5">
        <CheckCheck size={14} />
        Shared to feed
      </div>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleShare} disabled={isPending} className="gap-1.5">
      {isPending ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
      Share to feed
    </Button>
  );
}
