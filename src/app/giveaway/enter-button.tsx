"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface Props {
  monthLabel: string;
  initialEntered: boolean;
  referralCode?: string | null;
}

export function EnterButton({ monthLabel, initialEntered, referralCode }: Props) {
  const [entered, setEntered] = useState(initialEntered);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

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

  function handleCopy() {
    if (!referralCode) return;
    const url = `${window.location.origin}/signup?ref=${referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (entered) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-green-700 font-semibold text-lg">
          <CheckCircle2 size={22} />
          You&apos;re entered for {monthLabel}!
        </div>
        {referralCode && (
          <div className="rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-3 space-y-2">
            <p className="text-xs font-medium text-green-800 dark:text-green-300">
              Boost your chances — share your referral link. Every friend who joins and adds a plant earns you +1 extra entry.
            </p>
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-green-700 text-white hover:bg-green-800 transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy referral link"}
            </button>
          </div>
        )}
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
