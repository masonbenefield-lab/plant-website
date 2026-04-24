import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { DeleteListingButton, PauseListingButton } from "./listing-actions";

const statusColor: Record<string, string> = {
  active:   "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  paused:   "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  sold_out: "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400",
};

export default async function AdminListingsPage() {
  const supabase = await createClient();

  const { data: listings } = await supabase
    .from("listings")
    .select("id, plant_name, variety, price_cents, status, category, seller_id, created_at")
    .order("created_at", { ascending: false });

  const sellerIds = [...new Set((listings ?? []).map(l => l.seller_id))];
  const { data: sellers } = sellerIds.length
    ? await supabase.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };
  const sellerMap = Object.fromEntries((sellers ?? []).map(s => [s.id, s]));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Listings</h1>
        <p className="text-muted-foreground text-sm mt-1">{listings?.length ?? 0} total listings</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Plant</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Seller</th>
              <th className="text-left px-4 py-3 font-medium">Price</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Date</th>
              <th className="text-left px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(listings ?? []).map((l, i) => {
              const seller = sellerMap[l.seller_id];
              return (
                <tr key={l.id} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{l.plant_name}</p>
                    {l.variety && <p className="text-xs text-muted-foreground">{l.variety}</p>}
                    {l.category && <p className="text-xs text-muted-foreground">{l.category}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {seller ? (
                      <Link href={`/sellers/${seller.username}`} className="text-green-700 hover:underline" target="_blank">
                        {seller.username}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium">{centsToDisplay(l.price_cents)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor[l.status] ?? "bg-muted text-muted-foreground"}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                    {new Date(l.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Link href={`/shop/${l.id}`} className="text-xs text-muted-foreground hover:underline" target="_blank">
                        View
                      </Link>
                      <PauseListingButton listingId={l.id} currentStatus={l.status} />
                      <DeleteListingButton listingId={l.id} plantName={l.plant_name} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!listings?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">No listings found.</p>
        )}
      </div>
    </div>
  );
}
