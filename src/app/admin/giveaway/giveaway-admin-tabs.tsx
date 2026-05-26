"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { GiveawayAdminClient } from "./giveaway-admin-client";
import { SponsorRequestsPanel } from "./sponsor-requests-panel";

type Month = {
  month: string;
  plant_name: string;
  image_url: string | null;
  sponsor_name: string | null;
  sponsor_username: string | null;
  sponsor_logo_url: string | null;
  sponsor_message: string | null;
};

type Request = {
  id: string;
  user_id: string;
  item_name: string;
  message: string | null;
  status: "open" | "closed";
  created_at: string;
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
};

const TABS = ["Monthly Sponsors", "Donation Requests"] as const;
type Tab = (typeof TABS)[number];

export function GiveawayAdminTabs({
  months,
  requests,
  requesterMap,
}: {
  months: Month[];
  requests: Request[];
  requesterMap: Record<string, Profile>;
}) {
  const [tab, setTab] = useState<Tab>("Monthly Sponsors");
  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Giveaway</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "relative px-4 py-2 text-sm font-medium transition-colors",
              tab === t
                ? "text-foreground border-b-2 border-foreground -mb-px"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t}
            {t === "Donation Requests" && openCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold rounded-full bg-green-600 text-white">
                {openCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "Monthly Sponsors" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">Set the sponsor shown on the public giveaway page.</p>
          <GiveawayAdminClient months={months} />
        </div>
      )}

      {tab === "Donation Requests" && (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Users who want to sponsor a giveaway. Reply via their messages inbox.
          </p>
          <SponsorRequestsPanel requests={requests} requesterMap={requesterMap} />
        </div>
      )}
    </div>
  );
}
