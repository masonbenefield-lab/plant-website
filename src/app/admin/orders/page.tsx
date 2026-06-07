import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { centsToDisplay } from "@/lib/stripe";
import { cn } from "@/lib/utils";
import Link from "next/link";

const statusColor: Record<string, string> = {
  pending:   "bg-muted text-muted-foreground",
  paid:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  shipped:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  delivered: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
};

const STUCK_DAYS = 5;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>;
}) {
  const { q, filter } = await searchParams;
  const showStuck = filter === "stuck";

  const supabase = await createClient();
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const stuckDate = new Date(Date.now() - STUCK_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // If searching by username, find matching profile IDs first
  let filteredBuyerSellerIds: string[] | null = null;
  if (q) {
    const { data: matched } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", `%${q}%`);
    filteredBuyerSellerIds = (matched ?? []).map(p => p.id);
  }

  let query = admin
    .from("orders")
    .select("id, amount_cents, status, created_at, buyer_id, seller_id, shipping_address")
    .order("created_at", { ascending: false });

  if (showStuck) {
    query = query.eq("status", "paid").lt("created_at", stuckDate);
  }

  const { data: orders } = await query;

  // Apply username filter client-side after fetch (Supabase can't OR on buyer_id/seller_id easily)
  const filtered = filteredBuyerSellerIds !== null
    ? (orders ?? []).filter(o =>
        filteredBuyerSellerIds!.includes(o.buyer_id) ||
        filteredBuyerSellerIds!.includes(o.seller_id)
      )
    : (orders ?? []);

  const userIds = [...new Set([
    ...filtered.map(o => o.buyer_id),
    ...filtered.map(o => o.seller_id),
  ])];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  // Fetch active disputes for these orders
  const orderIds = filtered.map(o => o.id);
  const { data: disputes } = orderIds.length
    ? await admin
        .from("order_disputes")
        .select("order_id, status")
        .in("order_id", orderIds)
        .in("status", ["open", "seller_notified", "seller_responded"])
    : { data: [] };
  const disputeByOrderId = Object.fromEntries((disputes ?? []).map(d => [d.order_id, d.status]));

  const now = Date.now();
  function isStuck(o: { status: string; created_at: string | null }) {
    return o.status === "paid" && o.created_at && now - new Date(o.created_at).getTime() > STUCK_DAYS * 24 * 60 * 60 * 1000;
  }

  const stuckCount = (orders ?? []).filter(isStuck).length;

  function tabHref(f?: string) {
    const p = new URLSearchParams();
    if (f) p.set("filter", f);
    if (q) p.set("q", q);
    return `/admin/orders${p.toString() ? `?${p}` : ""}`;
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">{filtered.length} order{filtered.length !== 1 ? "s" : ""}{q ? ` matching "${q}"` : ""}</p>
      </div>

      {/* Search */}
      <form className="mb-5">
        {showStuck && <input type="hidden" name="filter" value="stuck" />}
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by buyer or seller username…"
          className="w-full max-w-sm rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-leaf"
        />
      </form>

      {/* Tabs */}
      <div className="flex gap-1 border-b mb-6">
        {([
          { label: "All", f: undefined },
          { label: `Stuck (${stuckCount})`, f: "stuck" },
        ] as const).map(({ label, f }) => {
          const active = showStuck ? f === "stuck" : f === undefined;
          return (
            <Link
              key={label}
              href={tabHref(f)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                active
                  ? "border-orange-600 text-orange-600"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {f === "stuck" && stuckCount > 0 && !active && (
                <span className="rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 font-semibold leading-none">
                  {stuckCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Amount</th>
              <th className="text-left px-4 py-3 font-medium">Buyer</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Seller</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Ship To</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o, i) => {
              const addr = o.shipping_address as { name: string; city: string; state: string } | null;
              const stuck = isStuck(o);
              const hasDispute = !!disputeByOrderId[o.id];
              return (
                <tr
                  key={o.id}
                  className={cn(
                    i % 2 === 0 ? "bg-card" : "bg-muted/20",
                    stuck && "bg-orange-50 dark:bg-orange-950/20"
                  )}
                >
                  <td className="px-4 py-3 font-medium">{centsToDisplay(o.amount_cents)}</td>
                  <td className="px-4 py-3">{profileMap[o.buyer_id]?.username ?? "—"}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{profileMap[o.seller_id]?.username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[o.status] ?? "bg-muted text-muted-foreground"}`}>
                        {o.status}
                      </span>
                      {stuck && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400">
                          Stuck
                        </span>
                      )}
                      {hasDispute && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400">
                          Dispute
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {addr ? `${addr.name}, ${addr.city}, ${addr.state}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">
            {q ? `No orders matching "${q}"` : showStuck ? "No stuck orders. All good!" : "No orders found."}
          </p>
        )}
      </div>
    </div>
  );
}
