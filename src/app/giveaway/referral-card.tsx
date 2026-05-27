"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ReferralCard({
  referralCode,
  bonusEntries,
}: {
  referralCode: string;
  bonusEntries: number;
}) {
  const [copied, setCopied] = useState(false);

  const referralUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/signup?ref=${referralCode}`
      : `https://plantet.shop/signup?ref=${referralCode}`;

  function handleCopy() {
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Card className="border-green-200 dark:border-green-800">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-green-700 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Refer friends for bonus entries</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share your link. When someone signs up and adds their first plant to their Plantet garden, you get +1 entry into that month&apos;s giveaway. No limit — the more friends you refer, the more entries you earn.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0 px-3 py-2 text-xs rounded-md border bg-muted text-muted-foreground truncate font-mono">
            {referralUrl}
          </div>
          <button
            onClick={handleCopy}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors"
          >
            {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {bonusEntries > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2">
            <span className="text-green-700 dark:text-green-400 font-bold text-sm">+{bonusEntries}</span>
            <span className="text-xs text-green-800 dark:text-green-300">
              bonus {bonusEntries === 1 ? "entry" : "entries"} this month from your referrals
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
