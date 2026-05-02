import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { censorWord } from "@/lib/profanity";

const contextLabel: Record<string, string> = {
  "username":                "Username",
  "bio":                     "Bio",
  "location":                "Location",
  "inventory-plant name":    "Inventory — Plant Name",
  "inventory-variety":       "Inventory — Variety",
  "inventory-description":   "Inventory — Description",
  "inventory-edit-plant name": "Inventory Edit — Plant Name",
  "inventory-edit-variety":  "Inventory Edit — Variety",
  "inventory-edit-description": "Inventory Edit — Description",
  "inventory-edit-notes":    "Inventory Edit — Notes",
  "review-comment":          "Review Comment",
};

export default async function AdminViolationsPage() {
  const supabase = await createClient();

  const { data: violations } = await supabase
    .from("word_violations")
    .select("id, user_id, word, context, content_snippet, created_at")
    .order("created_at", { ascending: false });

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username");

  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  // Group by user
  const byUser = new Map<string, {
    userId: string;
    username: string;
    count: number;
    words: Set<string>;
    contexts: string[];
    lastSeen: string;
  }>();

  for (const v of violations ?? []) {
    if (!byUser.has(v.user_id)) {
      byUser.set(v.user_id, {
        userId: v.user_id,
        username: profileMap[v.user_id]?.username ?? "Deleted user",
        count: 0,
        words: new Set(),
        contexts: [],
        lastSeen: v.created_at,
      });
    }
    const entry = byUser.get(v.user_id)!;
    entry.count += 1;
    entry.words.add(v.word);
    if (!entry.contexts.includes(v.context)) entry.contexts.push(v.context);
    if (v.created_at > entry.lastSeen) entry.lastSeen = v.created_at;
  }

  const users = Array.from(byUser.values()).sort((a, b) => b.count - a.count);
  const flaggedCount = users.filter(u => u.count >= 3).length;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Word Violations</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {users.length} user{users.length !== 1 ? "s" : ""} flagged ·{" "}
          {(violations ?? []).length} total violations ·{" "}
          <span className="text-red-600 font-medium">{flaggedCount} repeat offender{flaggedCount !== 1 ? "s" : ""} (3+)</span>
        </p>
      </div>

      {users.length === 0 ? (
        <p className="text-muted-foreground text-sm py-10 text-center">No violations recorded yet.</p>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Violations</th>
                <th className="text-left px-4 py-3 font-medium">Words Used</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Where</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Last Seen</th>
                <th className="text-left px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => {
                const isRepeat = u.count >= 3;
                return (
                  <tr key={u.userId} className={cn(i % 2 === 0 ? "bg-card" : "bg-muted/20", isRepeat && "border-l-4 border-l-red-500")}>
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        {u.username}
                        {isRepeat && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-xs font-semibold">
                            Repeat
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">
                      {u.count}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {Array.from(u.words).map(w => (
                          <span key={w} className="inline-flex items-center rounded bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 text-xs font-mono">
                            {censorWord(w)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      <div className="space-y-0.5">
                        {u.contexts.slice(0, 3).map(c => (
                          <div key={c} className="text-xs">{contextLabel[c] ?? c}</div>
                        ))}
                        {u.contexts.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{u.contexts.length - 3} more</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell text-xs">
                      {new Date(u.lastSeen).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users?q=${encodeURIComponent(u.username)}`}
                        className="text-xs text-orange-700 hover:underline font-medium"
                      >
                        View User →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent violations log */}
      <div className="mt-10">
        <h2 className="text-base font-semibold mb-4">Recent Violation Log</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">User</th>
                <th className="text-left px-4 py-3 font-medium">Word</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Where</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Snippet</th>
                <th className="text-left px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {(violations ?? []).slice(0, 50).map((v, i) => (
                <tr key={v.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-2.5 font-medium text-xs">
                    {profileMap[v.user_id]?.username ?? "Deleted"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 px-1.5 py-0.5 rounded">
                      {censorWord(v.word)}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden md:table-cell">
                    {contextLabel[v.context] ?? v.context}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs hidden lg:table-cell max-w-[200px] truncate">
                    {v.content_snippet ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">
                    {new Date(v.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!violations?.length && (
            <p className="px-4 py-8 text-center text-muted-foreground text-sm">No violations logged yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
