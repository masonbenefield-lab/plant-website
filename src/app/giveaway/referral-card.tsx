"use client";

import { useState } from "react";
import { Copy, Check, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function ReferralCard({
  referralCode,
  bonusEntries,
  alreadyEntered,
}: {
  referralCode: string;
  bonusEntries: number;
  alreadyEntered: boolean;
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
    <Card className="border-[#C5D4BC] dark:border-forest">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <Users size={18} className="text-leaf mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Refer friends for bonus entries</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share your link and earn bonus entries: <strong className="text-foreground">+1</strong> when a friend signs up and adds their first plant, <strong className="text-foreground">+2</strong> when a friend lists an item or starts an auction. No limit — the more you refer, the more entries you earn.
            </p>
          </div>
        </div>

        {alreadyEntered ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0 px-3 py-2 text-xs rounded-md border bg-muted text-muted-foreground truncate font-mono">
              {referralUrl}
            </div>
            <button
              onClick={handleCopy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted transition-colors"
            >
              {copied ? <Check size={13} className="text-leaf" /> : <Copy size={13} />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        ) : (
          <div className="px-3 py-2.5 rounded-md border border-dashed text-xs text-muted-foreground text-center">
            🔒 Enter this month&apos;s giveaway to unlock your referral link
          </div>
        )}

        {bonusEntries > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-[#EBF0E6] dark:bg-forest/20 px-3 py-2">
            <span className="text-leaf dark:text-sage font-bold text-sm">+{bonusEntries}</span>
            <span className="text-xs text-forest dark:text-[#A8BF9A]">
              bonus {bonusEntries === 1 ? "entry" : "entries"} this month from your referrals
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
