import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { ReportActions } from "./report-actions";

const statusColor: Record<string, string> = {
  pending:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  resolved:  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  dismissed: "bg-muted text-muted-foreground",
};

const typeLabel: Record<string, string> = {
  listing: "Listing",
  auction: "Auction",
  user:    "User",
};

const typeColor: Record<string, string> = {
  listing: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  auction: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  user:    "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
};

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showAll = tab === "all";
  const supabase = await createClient();

  let query = supabase
    .from("reports")
    .select("id, reason, details, status, admin_note, created_at, reporter_id, listing_id, auction_id, reported_user_id")
    .order("created_at", { ascending: false });

  if (!showAll) query = query.eq("status", "pending");

  const [
    { data: reports },
    { count: pendingCount },
    { count: totalCount },
  ] = await Promise.all([
    query,
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("reports").select("*", { count: "exact", head: true }),
  ]);

  // Gather IDs to resolve names
  const reporterIds = [...new Set((reports ?? []).map(r => r.reporter_id).filter(Boolean))];
  const listingIds  = [...new Set((reports ?? []).map(r => r.listing_id).filter(Boolean))];
  const auctionIds  = [...new Set((reports ?? []).map(r => r.auction_id).filter(Boolean))];
  const userIds     = [...new Set((reports ?? []).map(r => r.reported_user_id).filter(Boolean))];

  const [{ data: reporters }, { data: listings }, { data: auctions }, { data: reportedUsers }] =
    await Promise.all([
      reporterIds.length ? supabase.from("profiles").select("id, username").in("id", reporterIds) : { data: [] },
      listingIds.length  ? supabase.from("listings").select("id, plant_name").in("id", listingIds)   : { data: [] },
      auctionIds.length  ? supabase.from("auctions").select("id, plant_name").in("id", auctionIds)   : { data: [] },
      userIds.length     ? supabase.from("profiles").select("id, username").in("id", userIds)        : { data: [] },
    ]);

  const reporterMap    = Object.fromEntries((reporters    ?? []).map(r => [r.id, r]));
  const listingMap     = Object.fromEntries((listings     ?? []).map(l => [l.id, l]));
  const auctionMap     = Object.fromEntries((auctions     ?? []).map(a => [a.id, a]));
  const reportedUserMap = Object.fromEntries((reportedUsers ?? []).map(u => [u.id, u]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {pendingCount ?? 0} pending · {totalCount ?? 0} total
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {([["pending", false], ["all", true]] as const).map(([label, isAll]) => {
          const active = isAll === showAll;
          const count = isAll ? (totalCount ?? 0) : (pendingCount ?? 0);
          return (
            <Link
              key={label}
              href={isAll ? "/admin/reports?tab=all" : "/admin/reports"}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize",
                active
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className={cn(
                "rounded-full px-2 py-0.5 text-xs",
                !isAll && (pendingCount ?? 0) > 0 ? "bg-red-100 text-red-600" : "bg-muted text-muted-foreground"
              )}>
                {count}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Type</th>
              <th className="text-left px-4 py-3 font-medium">Target</th>
              <th className="text-left px-4 py-3 font-medium">Reason</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Reporter</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
              {showAll && <th className="text-left px-4 py-3 font-medium">Status</th>}
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(reports ?? []).map((r, i) => {
              const type = r.listing_id ? "listing" : r.auction_id ? "auction" : "user";
              const target =
                r.listing_id  ? listingMap[r.listing_id]
                : r.auction_id ? auctionMap[r.auction_id]
                : r.reported_user_id ? reportedUserMap[r.reported_user_id]
                : null;
              const targetName = target
                ? ("plant_name" in target ? target.plant_name : target.username)
                : "Deleted";
              const targetHref =
                r.listing_id  ? `/shop/${r.listing_id}`
                : r.auction_id ? `/auctions/${r.auction_id}`
                : r.reported_user_id && target ? `/sellers/${(target as { username: string }).username}`
                : null;
              const reporter = r.reporter_id ? reporterMap[r.reporter_id] : null;

              return (
                <tr key={r.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", typeColor[type])}>
                      {typeLabel[type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {targetHref ? (
                      <Link href={targetHref} className="hover:underline text-green-700" target="_blank">
                        {targetName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">{targetName}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.reason}</p>
                    {r.details && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{r.details}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {reporter?.username ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  {showAll && (
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", statusColor[r.status] ?? "bg-muted text-muted-foreground")}>
                        {r.status}
                        {r.admin_note && " ·"}
                      </span>
                      {r.admin_note && (
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[160px] truncate">{r.admin_note}</p>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {r.status === "pending" ? (
                      <ReportActions
                        reportId={r.id}
                        listingId={r.listing_id}
                        auctionId={r.auction_id}
                        reportedUserId={r.reported_user_id}
                        targetName={targetName}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground capitalize">{r.status}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!reports?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            {showAll ? "No reports found." : "No pending reports."}
          </p>
        )}
      </div>
    </div>
  );
}
