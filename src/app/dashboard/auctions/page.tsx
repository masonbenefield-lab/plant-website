import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { Pagination } from "@/components/pagination";
import DashboardSearch from "@/components/dashboard-search";

const PAGE_SIZE = 25;

export default async function DashboardAuctionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("seller_terms_accepted_at, stripe_onboarded")
    .eq("id", user.id)
    .single();

  if (!profile?.seller_terms_accepted_at) {
    redirect("/seller-agreement?next=/dashboard/auctions");
  }

  const stripeOnboarded = !!profile?.stripe_onboarded;

  let auctionsQuery = supabase
    .from("auctions")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (q) auctionsQuery = auctionsQuery.or(`plant_name.ilike.%${q}%,variety.ilike.%${q}%`);

  const { data: auctions, count } = await auctionsQuery.range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Auctions</h1>
        <Link href="/dashboard/inventory" className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors">
          Create from Inventory →
        </Link>
      </div>
      <div className="mb-6">
        <DashboardSearch placeholder="Search auctions…" basePath="/dashboard/auctions" />
      </div>
      {!stripeOnboarded && !!auctions?.length && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong>Your auctions are not visible to buyers yet.</strong> They appear on your personal storefront, but won&apos;t show in the public auctions page and cannot be bid on until you{" "}
          <a href="/account#seller-payments" className="underline font-medium hover:opacity-80">connect your Stripe account</a>.
        </div>
      )}
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
        prevHref={page > 1 ? `/dashboard/auctions?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
        nextHref={page < totalPages ? `/dashboard/auctions?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}` : null}
      />
    </div>
  );
}
