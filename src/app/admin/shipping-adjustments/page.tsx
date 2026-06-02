import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { centsToDisplay } from "@/lib/stripe";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export default async function ShippingAdjustmentsPage() {
  const admin = adminClient();

  const { data: adjustments } = await admin
    .from("shipping_adjustments")
    .select("id, order_id, seller_id, shippo_transaction_id, original_weight_oz, billed_weight_oz, adjustment_cents, created_at")
    .order("created_at", { ascending: false });

  // Aggregate by seller
  const sellerTotals = new Map<string, { count: number; totalCents: number }>();
  for (const a of adjustments ?? []) {
    if (!a.seller_id) continue;
    const existing = sellerTotals.get(a.seller_id) ?? { count: 0, totalCents: 0 };
    sellerTotals.set(a.seller_id, {
      count: existing.count + 1,
      totalCents: existing.totalCents + a.adjustment_cents,
    });
  }

  const sellerIds = [...new Set((adjustments ?? []).map(a => a.seller_id).filter(Boolean))] as string[];
  const { data: profiles } = sellerIds.length
    ? await admin.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  const repeatOffenders = sellerIds
    .map(id => ({ id, username: profileMap[id]?.username ?? id, ...sellerTotals.get(id)! }))
    .filter(s => s.count >= 2)
    .sort((a, b) => b.count - a.count);

  return (
    <div className="p-8 space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Shipping Adjustments</h1>
        <p className="text-muted-foreground text-sm mt-1">
          USPS postage-due charges billed back via Shippo. {adjustments?.length ?? 0} total adjustments.
        </p>
      </div>

      {/* Repeat offender summary */}
      {repeatOffenders.length > 0 && (
        <div>
          <h2 className="text-base font-semibold mb-3 text-red-600 dark:text-red-400">⚠️ Repeat Offenders (2+ adjustments)</h2>
          <div className="rounded-lg border border-red-200 dark:border-red-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-red-50 dark:bg-red-900/20 text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Seller</th>
                  <th className="text-left px-4 py-3 font-medium">Adjustments</th>
                  <th className="text-left px-4 py-3 font-medium">Total Billed</th>
                </tr>
              </thead>
              <tbody>
                {repeatOffenders.map((s, i) => (
                  <tr key={s.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="px-4 py-3 font-medium text-red-700 dark:text-red-400">{s.username}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2.5 py-0.5 text-xs font-semibold">
                        {s.count}×
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{centsToDisplay(s.totalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All adjustments */}
      <div>
        <h2 className="text-base font-semibold mb-3">All Adjustments</h2>
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Date</th>
                <th className="text-left px-4 py-3 font-medium">Seller</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Order</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Reported oz</th>
                <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Billed oz</th>
                <th className="text-left px-4 py-3 font-medium">Adjustment</th>
              </tr>
            </thead>
            <tbody>
              {(adjustments ?? []).map((a, i) => {
                const seller = a.seller_id ? profileMap[a.seller_id] : null;
                const isRepeat = a.seller_id ? (sellerTotals.get(a.seller_id)?.count ?? 0) >= 2 : false;
                return (
                  <tr key={a.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={isRepeat ? "font-medium text-red-600 dark:text-red-400" : ""}>
                        {seller?.username ?? "—"}
                      </span>
                      {isRepeat && <span className="ml-1.5 text-xs text-red-500">⚠️</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden md:table-cell font-mono text-xs">
                      {a.order_id ? a.order_id.slice(0, 8) + "…" : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {a.original_weight_oz != null ? `${a.original_weight_oz} oz` : "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {a.billed_weight_oz != null ? `${a.billed_weight_oz} oz` : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-red-600 dark:text-red-400">
                      +{centsToDisplay(a.adjustment_cents)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!adjustments?.length && (
            <p className="px-4 py-10 text-center text-muted-foreground text-sm">No adjustments recorded yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
