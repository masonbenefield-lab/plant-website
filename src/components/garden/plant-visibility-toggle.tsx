"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  plantId: string;
  initialPublic: boolean;
  variant?: "icon" | "full";
}

export function PlantVisibilityToggle({ plantId, initialPublic, variant = "full" }: Props) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [isPending, startTransition] = useTransition();

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const next = !isPublic;
      const supabase = createClient();
      const { error } = await supabase
        .from("garden_plants")
        .update({ is_public: next })
        .eq("id", plantId);
      if (error) { toast.error("Failed to update visibility"); return; }
      setIsPublic(next);
      toast.success(next ? "Plant is now visible in your public garden" : "Plant is now hidden from your public garden");
    });
  }

  if (variant === "icon") {
    return (
      <button
        onClick={toggle}
        disabled={isPending}
        title={isPublic ? "Visible in public garden — click to hide" : "Hidden from public garden — click to show"}
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm",
          isPublic
            ? "bg-green-600/90 text-white hover:bg-green-700"
            : "bg-black/50 text-white/70 hover:bg-black/70"
        )}
      >
        {isPending
          ? <Loader2 size={11} className="animate-spin" />
          : isPublic
            ? <Eye size={11} />
            : <EyeOff size={11} />
        }
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      disabled={isPending}
      className={cn(
        "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border transition-colors",
        isPublic
          ? "bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
          : "bg-muted border-border text-muted-foreground hover:text-foreground hover:border-green-400"
      )}
    >
      {isPending
        ? <Loader2 size={13} className="animate-spin" />
        : isPublic
          ? <Eye size={13} />
          : <EyeOff size={13} />
      }
      {isPublic ? "Visible in public garden" : "Hidden from public garden"}
    </button>
  );
}
