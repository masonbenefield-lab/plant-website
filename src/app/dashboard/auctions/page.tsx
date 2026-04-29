import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import NewAuctionDialog from "./new-auction-dialog";
import AuctionActions from "./auction-actions";

export default async function DashboardAuctionsPage() {
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

  const { data: auctions } = await supabase
    .from("auctions")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Auctions</h1>
        <NewAuctionDialog sellerId={user.id} />
      </div>

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
                  <AuctionActions auctionId={auction.id} />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
