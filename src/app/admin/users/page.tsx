import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";

export default async function AdminUsersPage() {
  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, username, bio, avatar_url, stripe_onboarded, is_admin, created_at")
    .order("created_at", { ascending: false });

  const ids = (profiles ?? []).map(p => p.id);

  const [{ data: listingCounts }, { data: auctionCounts }] = await Promise.all([
    ids.length
      ? supabase.from("listings").select("seller_id").in("seller_id", ids)
      : { data: [] },
    ids.length
      ? supabase.from("auctions").select("seller_id").in("seller_id", ids)
      : { data: [] },
  ]);

  const listingMap: Record<string, number> = {};
  (listingCounts ?? []).forEach(r => { listingMap[r.seller_id] = (listingMap[r.seller_id] ?? 0) + 1; });

  const auctionMap: Record<string, number> = {};
  (auctionCounts ?? []).forEach(r => { auctionMap[r.seller_id] = (auctionMap[r.seller_id] ?? 0) + 1; });

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <p className="text-muted-foreground text-sm mt-1">{profiles?.length ?? 0} registered users</p>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Username</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Joined</th>
              <th className="text-left px-4 py-3 font-medium">Listings</th>
              <th className="text-left px-4 py-3 font-medium">Auctions</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Status</th>
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
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {new Date(p.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">{listingMap[p.id] ?? 0}</td>
                <td className="px-4 py-3">{auctionMap[p.id] ?? 0}</td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  {p.stripe_onboarded ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
                      Stripe connected
                    </Badge>
                  ) : (
                    <Badge variant="secondary">No payments</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/sellers/${p.username}`}
                    className="text-xs text-green-700 hover:underline font-medium"
                    target="_blank"
                  >
                    Storefront →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!profiles?.length && (
          <p className="px-4 py-10 text-center text-muted-foreground text-sm">No users found.</p>
        )}
      </div>
    </div>
  );
}
