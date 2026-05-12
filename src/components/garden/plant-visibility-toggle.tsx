"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  plantId: string;
  initialPublic: boolean;
  gardenPublic?: boolean;
  variant?: "icon" | "full";
}

export function PlantVisibilityToggle({ plantId, initialPublic, gardenPublic, variant = "full" }: Props) {
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

  const gardenPrivateWarning = gardenPublic === false
    ? "Your garden is set to private — this plant won't be visible until you make your garden public"
    : undefined;

  if (variant === "icon") {
    const title = gardenPublic === false && isPublic
      ? "Garden is private — plant is set to visible but hidden until garden is made public"
      : isPublic
        ? "Visible in public garden — click to hide"
        : "Hidden from public garden — click to show";

    return (
      <button
        onClick={toggle}
        disabled={isPending}
        title={title}
        className={cn(
          "w-6 h-6 rounded-full flex items-center justify-center transition-colors shadow-sm",
          gardenPublic === false && isPublic
            ? "bg-amber-500/90 text-white hover:bg-amber-600"
            : isPublic
              ? "bg-green-600/90 text-white hover:bg-green-700"
              : "bg-black/50 text-white/70 hover:bg-black/70"
        )}
      >
        {isPending
          ? <Loader2 size={11} className="animate-spin" />
          : gardenPublic === false && isPublic
            ? <AlertTriangle size={11} />
            : isPublic
              ? <Eye size={11} />
              : <EyeOff size={11} />
        }
      </button>
    );
  }

  return (
    <div className="space-y-1.5">
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
      {isPublic && gardenPrivateWarning && (
        <p className="flex items-center gap-1 text-xs text-amber-600">
          <AlertTriangle size={11} className="shrink-0" />
          {gardenPrivateWarning}
        </p>
      )}
    </div>
  );
}
