"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  monthLabel: string; // e.g. "May 2026"
  initialEntered: boolean;
}

export function EnterButton({ monthLabel, initialEntered }: Props) {
  const [entered, setEntered] = useState(initialEntered);
  const [isPending, startTransition] = useTransition();

  function handleEnter() {
    startTransition(async () => {
      const res = await fetch("/api/giveaway/enter", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Something went wrong");
        return;
      }
      setEntered(true);
      if (!json.already) toast.success(`You're entered for ${monthLabel}! Good luck!`);
    });
  }

  if (entered) {
    return (
      <div className="flex items-center gap-2 text-green-700 font-semibold text-lg">
        <CheckCircle2 size={22} />
        You&apos;re entered for {monthLabel}!
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="bg-green-700 hover:bg-green-800 text-white px-10 text-base"
      onClick={handleEnter}
      disabled={isPending}
    >
      {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
      Enter to Win
    </Button>
  );
}
