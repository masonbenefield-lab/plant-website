"use client";

import { useState } from "react";
import { Ban } from "lucide-react";
import { toast } from "sonner";

interface BlockedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function BlockedUsers({ initialBlocked }: { initialBlocked: BlockedUser[] }) {
  const [blocked, setBlocked] = useState(initialBlocked);
  const [loading, setLoading] = useState<string | null>(null);

  async function unblock(blockedId: string) {
    setLoading(blockedId);
    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockedId, action: "unblock" }),
    });
    setLoading(null);
    if (!res.ok) {
      toast.error("Something went wrong.");
      return;
    }
    setBlocked((prev) => prev.filter((u) => u.id !== blockedId));
    toast.success("User unblocked.");
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Blocked Users</h2>
        <p className="text-sm text-muted-foreground">
          Blocked users can&apos;t message you, bid on your auctions, or purchase your listings.
        </p>
      </div>
      {blocked.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border">
          {blocked.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-3">
                {u.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.avatar_url} alt={u.username} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-[#DFE7D4] flex items-center justify-center text-leaf text-sm font-bold">
                    {u.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium leading-tight">{u.display_name || u.username}</p>
                  {u.display_name && (
                    <p className="text-xs text-muted-foreground leading-tight">@{u.username}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => unblock(u.id)}
                disabled={loading === u.id}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Ban size={12} />
                {loading === u.id ? "Unblocking…" : "Unblock"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
