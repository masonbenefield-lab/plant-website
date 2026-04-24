import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";

const statusColor: Record<string, string> = {
  pending:   "bg-muted text-muted-foreground",
  paid:      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  shipped:   "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

export default async function AdminOrdersPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, amount_cents, status, created_at, buyer_id, seller_id, listing_id, auction_id, shipping_address")
    .order("created_at", { ascending: false });

  const userIds = [...new Set([
    ...(orders ?? []).map(o => o.buyer_id),
    ...(orders ?? []).map(o => o.seller_id),
  ])];
  const { data: profiles } = userIds.length
    ? await supabase.from("profiles").select("id, username").in("id", userIds)
    : { data: [] };
  const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <p className="text-muted-foreground text-sm mt-1">{orders?.length ?? 0} total orders</p>
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
            {(orders ?? []).map((o, i) => {
              const addr = o.shipping_address as { name: string; city: string; state: string } | null;
              return (
                <tr key={o.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3 font-medium">{centsToDisplay(o.amount_cents)}</td>
                  <td className="px-4 py-3">{profileMap[o.buyer_id]?.username ?? "—"}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{profileMap[o.seller_id]?.username ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[o.status] ?? "bg-muted text-muted-foreground"}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {addr ? `${addr.name}, ${addr.city}, ${addr.state}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!orders?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">No orders found.</p>
        )}
      </div>
    </div>
  );
}
