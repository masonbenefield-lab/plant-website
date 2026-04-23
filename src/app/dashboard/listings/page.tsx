import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import ListingActions from "./listing-actions";
import NewListingDialog from "./new-listing-dialog";

export default async function DashboardListingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: listings } = await supabase
    .from("listings")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <NewListingDialog sellerId={user.id} />
      </div>

      {!listings?.length ? (
        <p className="text-muted-foreground">No listings yet. Create your first one!</p>
      ) : (
        <div className="space-y-3">
          {listings.map((listing) => (
            <Card key={listing.id}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{listing.plant_name}</span>
                    {listing.variety && (
                      <span className="text-sm text-muted-foreground">— {listing.variety}</span>
                    )}
                    <Badge
                      variant={listing.status === "active" ? "default" : "secondary"}
                      className={listing.status === "active" ? "bg-green-700" : ""}
                    >
                      {listing.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{centsToDisplay(listing.price_cents)}</span>
                    <span>{listing.quantity} in stock</span>
                  </div>
                </div>
                <ListingActions listing={listing} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
