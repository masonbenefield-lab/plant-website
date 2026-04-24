import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import UserSearch from "./user-search";
import { DeleteUserButton, RestoreUserButton } from "./user-actions";

function daysUntilPurge(deletedAt: string) {
  const purge = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((purge - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const showArchived = tab === "archived";
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, username, bio, stripe_onboarded, is_admin, deleted_at, created_at")
    .order("created_at", { ascending: false });

  query = showArchived
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);

  if (q) query = query.ilike("username", `%${q}%`);

  const [
    { data: profiles },
    { count: activeCount },
    { count: archivedCount },
  ] = await Promise.all([
    query,
    supabase.from("profiles").select("*", { count: "exact", head: true }).is("deleted_at", null),
    supabase.from("profiles").select("*", { count: "exact", head: true }).not("deleted_at", "is", null),
  ]);

  const ids = (profiles ?? []).map(p => p.id);
  const [{ data: listingRows }, { data: auctionRows }] = await Promise.all([
    ids.length ? supabase.from("listings").select("seller_id").in("seller_id", ids) : { data: [] },
    ids.length ? supabase.from("auctions").select("seller_id").in("seller_id", ids) : { data: [] },
  ]);

  const listingMap: Record<string, number> = {};
  (listingRows ?? []).forEach(r => { listingMap[r.seller_id] = (listingMap[r.seller_id] ?? 0) + 1; });

  const auctionMap: Record<string, number> = {};
  (auctionRows ?? []).forEach(r => { auctionMap[r.seller_id] = (auctionMap[r.seller_id] ?? 0) + 1; });

  function tabHref(t: "active" | "archived") {
    const params = new URLSearchParams();
    if (t === "archived") params.set("tab", "archived");
    if (q) params.set("q", q);
    const qs = params.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {activeCount ?? 0} active · {archivedCount ?? 0} archived
        </p>
      </div>

      <div className="mb-5">
        <Suspense>
          <UserSearch defaultValue={q} />
        </Suspense>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {(["active", "archived"] as const).map((t) => {
          const isActive = t === "archived" ? showArchived : !showArchived;
          const count = t === "archived" ? archivedCount : activeCount;
          return (
            <Link
              key={t}
              href={tabHref(t)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
                isActive
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                t === "archived" && (archivedCount ?? 0) > 0
                  ? "bg-orange-100 text-orange-600"
                  : "bg-muted text-muted-foreground"
              )}>
                {count ?? 0}
              </span>
            </Link>
          );
        })}
      </div>

      {showArchived && (archivedCount ?? 0) > 0 && (
        <div className="mb-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 px-4 py-3 text-sm text-orange-700 dark:text-orange-400">
          Archived users are permanently deleted after 30 days. Restore to keep them.
        </div>
      )}

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Username</th>
              {!showArchived && (
                <>
                  <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Joined</th>
                  <th className="text-left px-4 py-3 font-medium">Listings</th>
                  <th className="text-left px-4 py-3 font-medium">Auctions</th>
                  <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Payments</th>
                </>
              )}
              {showArchived && (
                <th className="text-left px-4 py-3 font-medium">Days until purge</th>
              )}
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p, i) => (
              <tr key={p.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{p.username}</span>
                    {p.is_admin && (
                      <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 px-1.5 py-0.5 rounded-full font-medium">
                        Admin
                      </span>
                    )}
                  </div>
                  {p.bio && <p className="text-xs text-muted-foreground truncate max-w-[200px]">{p.bio}</p>}
                </td>
                {!showArchived && (
                  <>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                      {new Date(p.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">{listingMap[p.id] ?? 0}</td>
                    <td className="px-4 py-3">{auctionMap[p.id] ?? 0}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {p.stripe_onboarded ? (
                        <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                          Connected
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Not set up</Badge>
                      )}
                    </td>
                  </>
                )}
                {showArchived && p.deleted_at && (
                  <td className="px-4 py-3">
                    <span className="text-sm font-medium text-orange-600">
                      {daysUntilPurge(p.deleted_at)}d left
                    </span>
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Link href={`/sellers/${p.username}`} className="text-xs text-muted-foreground hover:underline" target="_blank">
                      Storefront →
                    </Link>
                    {showArchived ? (
                      <RestoreUserButton userId={p.id} username={p.username} />
                    ) : (
                      <DeleteUserButton userId={p.id} username={p.username} isAdmin={p.is_admin} />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!profiles?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            {q ? `No ${showArchived ? "archived " : ""}users matching "${q}"` : showArchived ? "No archived users." : "No users found."}
          </p>
        )}
      </div>
    </div>
  );
}
