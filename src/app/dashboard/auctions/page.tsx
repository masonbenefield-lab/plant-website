import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { Pagination } from "@/components/pagination";

const PAGE_SIZE = 25;

export default async function DashboardAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/auctions");
  }

  const { data: auctions, count } = await supabase
    .from("auctions")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Auctions</h1>
        <Link href="/dashboard/inventory" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          Create from Inventory →
        </Link>
      </div>
      <p className="text-sm text-muted-foreground mb-6">To create a new auction, open an inventory item and click "Auction".</p>

      {!auctions?.length ? (
        <p className="text-muted-foreground">No auctions yet.</p>
      ) : (
        <div className="space-y-3">
          {auctions.map((auction) => (
            <Card key={auction.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{auction.plant_name}</span>
                    {auction.variety && (
                      <span className="text-sm text-muted-foreground">— {auction.variety}</span>
                    )}
                    <Badge
                      variant={auction.status === "active" ? "default" : "secondary"}
                      className={auction.status === "active" ? "bg-green-700" : ""}
                    >
                      {auction.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground flex-wrap">
                    <span>Starting: {centsToDisplay(auction.starting_bid_cents)}</span>
                    <span>Current: {centsToDisplay(auction.current_bid_cents)}</span>
                    {auction.buy_now_price_cents && (
                      <span className="text-orange-600 font-medium">Buy Now: {centsToDisplay(auction.buy_now_price_cents)}</span>
                    )}
                    <span>Ends: {new Date(auction.ends_at).toLocaleString()}</span>
                  </div>
                </div>
                {auction.status === "active" && (
                  <Link href={`/auctions/${auction.id}`} className="text-sm text-muted-foreground hover:underline shrink-0">
                    View →
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE}
        prevHref={page > 1 ? `/dashboard/auctions?page=${page - 1}` : null}
        nextHref={page < totalPages ? `/dashboard/auctions?page=${page + 1}` : null}
      />
    </div>
  );
}
