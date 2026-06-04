import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import AdminNav from "./admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) redirect("/");

  const admin = createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ count: pendingReports }, { count: pendingReviewReports, }, { data: violationUsers }, { data: adjustmentRows }] = await Promise.all([
    supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("review_reports").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("word_violations").select("user_id"),
    admin.from("shipping_adjustments").select("seller_id"),
  ]);

  const violationCounts = new Map<string, number>();
  for (const v of violationUsers ?? []) {
    violationCounts.set(v.user_id, (violationCounts.get(v.user_id) ?? 0) + 1);
  }
  const repeatViolators = Array.from(violationCounts.values()).filter(c => c >= 3).length;

  const adjustmentCounts = new Map<string, number>();
  for (const a of adjustmentRows ?? []) {
    if (!a.seller_id) continue;
    adjustmentCounts.set(a.seller_id, (adjustmentCounts.get(a.seller_id) ?? 0) + 1);
  }
  const repeatAdjustors = Array.from(adjustmentCounts.values()).filter(c => c >= 2).length;

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <AdminNav pendingReports={pendingReports ?? 0} pendingReviewReports={pendingReviewReports ?? 0} repeatViolators={repeatViolators} repeatAdjustors={repeatAdjustors} />
      <main className="flex-1 overflow-auto min-w-0">{children}</main>
    </div>
  );
}
