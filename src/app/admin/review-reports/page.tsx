import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { Star } from "lucide-react";
import { ReviewReportActions } from "./review-report-actions";

const REASON_LABEL: Record<string, string> = {
  fake:        "Not a real customer",
  harassment:  "Harassment or hate speech",
  wrong_order: "Wrong order / wrong seller",
  other:       "Other",
};

const STATUS_COLOR: Record<string, string> = {
  pending:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  dismissed: "bg-muted text-muted-foreground",
  deleted:   "bg-[#DFE7D4] text-leaf dark:bg-forest/30 dark:text-sage",
};

export default async function ReviewReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const showAll = tab === "all";

  const supabase = await createClient();
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  type ReportRow = {
    id: string;
    rating_id: string | null;
    reporter_id: string;
    reason: string;
    details: string | null;
    status: string;
    created_at: string;
  };

  let query = admin
    .from("review_reports" as never)
    .select("id, rating_id, reporter_id, reason, details, status, created_at")
    .order("created_at", { ascending: false });

  if (!showAll) (query as { eq: (col: string, val: string) => typeof query }).eq("status", "pending");

  const [
    { data: reports },
    { count: pendingCount },
    { count: totalCount },
  ] = await Promise.all([
    query as unknown as Promise<{ data: ReportRow[] }>,
    admin.from("review_reports" as never).select("*", { count: "exact", head: true }).eq("status", "pending") as unknown as Promise<{ count: number }>,
    admin.from("review_reports" as never).select("*", { count: "exact", head: true }) as unknown as Promise<{ count: number }>,
  ]);

  const ratingIds   = [...new Set((reports ?? []).map((r) => r.rating_id).filter(Boolean))] as string[];
  const reporterIds = [...new Set((reports ?? []).map((r) => r.reporter_id).filter(Boolean))] as string[];

  const [{ data: ratings }, { data: reporters }] = await Promise.all([
    ratingIds.length
      ? admin.from("ratings").select("id, score, comment, reviewer_id, seller_id, created_at").in("id", ratingIds)
      : { data: [] as { id: string; score: number; comment: string | null; reviewer_id: string; seller_id: string; created_at: string }[] },
    reporterIds.length
      ? supabase.from("profiles").select("id, username").in("id", reporterIds)
      : { data: [] as { id: string; username: string }[] },
  ]);

  const reviewerIds = [...new Set((ratings ?? []).map((r) => r.reviewer_id))];
  const sellerIds   = [...new Set((ratings ?? []).map((r) => r.seller_id))];

  const [{ data: reviewers }, { data: sellers }] = await Promise.all([
    reviewerIds.length ? supabase.from("profiles").select("id, username").in("id", reviewerIds) : { data: [] as { id: string; username: string }[] },
    sellerIds.length   ? supabase.from("profiles").select("id, username").in("id", sellerIds)   : { data: [] as { id: string; username: string }[] },
  ]);

  const ratingMap   = Object.fromEntries((ratings   ?? []).map((r) => [r.id, r]));
  const reporterMap = Object.fromEntries((reporters ?? []).map((r) => [r.id, r.username]));
  const reviewerMap = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r.username]));
  const sellerMap   = Object.fromEntries((sellers   ?? []).map((r) => [r.id, r.username]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Review Reports</h1>
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
              href={isAll ? "/admin/review-reports?tab=all" : "/admin/review-reports"}
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

      <div className="space-y-4">
        {(reports ?? []).map((report) => {
          const rating  = report.rating_id ? ratingMap[report.rating_id] : null;
          const seller  = rating ? sellerMap[rating.seller_id] : null;
          const reviewer = rating ? reviewerMap[rating.reviewer_id] : null;
          const reporter = reporterMap[report.reporter_id];

          return (
            <div key={report.id} className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", STATUS_COLOR[report.status] ?? "bg-muted text-muted-foreground")}>
                      {report.status}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Reported {new Date(report.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm">
                    <span className="font-medium">{reporter ?? "unknown"}</span>
                    <span className="text-muted-foreground"> reported a review on their shop</span>
                    {seller && (
                      <> — <Link href={`/sellers/${seller}`} className="text-leaf hover:underline" target="_blank">{seller}</Link></>
                    )}
                  </p>
                </div>
                {report.status === "pending" && (
                  <ReviewReportActions reportId={report.id} />
                )}
              </div>

              {/* The review being reported */}
              <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Review content</p>
                {rating ? (
                  <>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <Star key={n} className={`h-3.5 w-3.5 ${n <= rating.score ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        by <span className="font-medium">{reviewer ?? "unknown"}</span>
                        {" · "}
                        {new Date(rating.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    {rating.comment ? (
                      <p className="text-sm leading-relaxed">{rating.comment}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No comment left.</p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground italic">Review has been deleted.</p>
                )}
              </div>

              {/* Report reason */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Reported reason</p>
                <p className="text-sm font-medium">{REASON_LABEL[report.reason] ?? report.reason}</p>
                {report.details && (
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{report.details}</p>
                )}
              </div>
            </div>
          );
        })}

        {!(reports ?? []).length && (
          <p className="text-center py-16 text-muted-foreground text-sm">
            {showAll ? "No review reports found." : "No pending review reports."}
          </p>
        )}
      </div>
    </div>
  );
}
