import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { CancelAuctionButton, DeleteAuctionButton } from "./auction-actions";

const statusColor: Record<string, string> = {
  active:    "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  ended:     "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  cancelled: "bg-muted text-muted-foreground",
};

export default async function AdminAuctionsPage() {
  const supabase = await createClient();

  const { data: auctions } = await supabase
    .from("auctions")
    .select("id, plant_name, variety, current_bid_cents, starting_bid_cents, status, category, seller_id, ends_at, created_at")
    .order("created_at", { ascending: false });

  const sellerIds = [...new Set((auctions ?? []).map(a => a.seller_id))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers ?? []).map(s => [s.id, s]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Auctions</h1>
        <p className="text-muted-foreground text-sm mt-1">{auctions?.length ?? 0} total auctions</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Plant</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Seller</th>
              <th className="text-left px-4 py-3 font-medium">Current Bid</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Ends</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(auctions ?? []).map((a, i) => {
              const seller = sellerMap[a.seller_id];
              return (
                <tr key={a.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.plant_name}</p>
                    {a.variety && <p className="text-xs text-muted-foreground">{a.variety}</p>}
                    {a.category && <p className="text-xs text-muted-foreground">{a.category}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {seller ? (
                      <Link href={`/sellers/${seller.username}`} className="text-green-700 hover:underline" target="_blank">
                        {seller.username}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{centsToDisplay(a.current_bid_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[a.status] ?? "bg-muted text-muted-foreground"}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(a.ends_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/auctions/${a.id}`} className="text-xs text-muted-foreground hover:underline" target="_blank">
                        View
                      </Link>
                      <CancelAuctionButton auctionId={a.id} plantName={a.plant_name} currentStatus={a.status} />
                      <DeleteAuctionButton auctionId={a.id} plantName={a.plant_name} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!auctions?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">No auctions found.</p>
        )}
      </div>
    </div>
  );
}
