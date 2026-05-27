"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Copy, Check, MapPin } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ELIGIBLE = ["US", "CA"];

const COUNTRY_OPTIONS = [
  { code: "US", label: "🇺🇸 United States" },
  { code: "CA", label: "🇨🇦 Canada" },
  { code: "OTHER", label: "🌍 Other country" },
];

interface Props {
  monthLabel: string;
  initialEntered: boolean;
  referralCode?: string | null;
  userCountry?: string | null;
}

export function EnterButton({ monthLabel, initialEntered, referralCode, userCountry }: Props) {
  const [entered, setEntered] = useState(initialEntered);
  const [isPending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [country, setCountry] = useState(userCountry ?? null);
  const [showPicker, setShowPicker] = useState(false);
  const [savingCountry, setSavingCountry] = useState(false);

  const isEligible = country ? ELIGIBLE.includes(country) : null; // null = unknown

  function handleCopy() {
    if (!referralCode) return;
    const url = `${window.location.origin}/signup?ref=${referralCode}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function saveCountry(code: string) {
    setSavingCountry(true);
    await fetch("/api/profile/set-country", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: code }),
    });
    setCountry(code);
    setSavingCountry(false);
    setShowPicker(false);

    if (ELIGIBLE.includes(code)) {
      doEnter();
    }
  }

  function doEnter() {
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

  function handleEnterClick() {
    if (!country) {
      setShowPicker(true);
      return;
    }
    if (!ELIGIBLE.includes(country)) return; // ineligible — button shouldn't be visible
    doEnter();
  }

  // Already entered
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
              Boost your chances — share your referral link. Every friend who signs up and adds at least one plant to their Plantet garden earns you +1 extra entry.
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

  // Ineligible country set
  if (country && !ELIGIBLE.includes(country)) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 space-y-1 max-w-sm">
        <p className="font-semibold">Not available in your region</p>
        <p className="text-xs">This giveaway is currently open to US and Canada residents only. We hope to expand in the future!</p>
      </div>
    );
  }

  // Country picker prompt
  if (showPicker) {
    return (
      <div className="space-y-3 max-w-xs">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapPin size={15} className="text-green-700" />
          Where are you located?
        </div>
        <p className="text-xs text-muted-foreground">This giveaway is open to US and Canada residents. We just need to confirm eligibility.</p>
        <div className="flex flex-col gap-2">
          {COUNTRY_OPTIONS.map((opt) => (
            <button
              key={opt.code}
              onClick={() => saveCountry(opt.code)}
              disabled={savingCountry}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium text-left transition-colors",
                "hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20"
              )}
            >
              {savingCountry ? <Loader2 size={14} className="animate-spin" /> : null}
              {opt.label}
            </button>
          ))}
        </div>
        <button onClick={() => setShowPicker(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
    );
  }

  // Default: enter button
  return (
    <Button
      size="lg"
      className="bg-green-700 hover:bg-green-800 text-white px-10 text-base"
      onClick={handleEnterClick}
      disabled={isPending}
    >
      {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
      Enter to Win
    </Button>
  );
}
