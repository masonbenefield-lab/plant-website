"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Trash2, Loader2 } from "lucide-react";

export function DeletePlantButton({ plantId, plantName }: { plantId: string; plantName: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase.from("garden_plants").delete().eq("id", plantId);
      if (error) {
        toast.error("Failed to delete plant");
        return;
      }
      toast.success(`${plantName} removed from your garden`);
      setOpen(false);
      router.push("/garden");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 hover:text-red-700 hover:border-red-300"
          />
        }
      >
        <Trash2 size={14} />
        Delete
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {plantName}?</DialogTitle>
          <DialogDescription>
            This will permanently delete this plant and all its care log events. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : null}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
