import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import RateSellerForm from "./rate-seller-form";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
};

export default async function MyOrdersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });

  if (!orders?.length) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">My Orders</h1>
        <p className="text-muted-foreground">No orders yet.</p>
      </div>
    );
  }

  const listingIds = orders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = orders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const sellerIds = [...new Set(orders.map((o) => o.seller_id))];

  const [{ data: listings }, { data: auctionItems }, { data: sellers }, { data: existingRatings }] =
    await Promise.all([
      listingIds.length
        ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds)
        : { data: [] },
      auctionIds.length
        ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds)
        : { data: [] },
      supabase.from("profiles").select("id, username").in("id", sellerIds),
      supabase.from("ratings").select("order_id").eq("reviewer_id", user.id),
    ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
  const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));
  const ratedOrderIds = new Set(existingRatings?.map((r) => r.order_id) ?? []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">My Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => {
          const item = order.listing_id
            ? listingMap[order.listing_id]
            : order.auction_id
            ? auctionMap[order.auction_id]
            : null;
          const seller = sellerMap[order.seller_id];

          return (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">
                      {item?.plant_name}
                      {item?.variety ? ` — ${item.variety}` : ""}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Seller: {seller?.username} · {centsToDisplay(order.amount_cents)}
                    </p>
                  </div>
                  <Badge className={statusColors[order.status] ?? ""} variant="secondary">
                    {order.status}
                  </Badge>
                </div>

                {order.status === "delivered" && !ratedOrderIds.has(order.id) && (
                  <div className="mt-4 pt-4 border-t">
                    <RateSellerForm orderId={order.id} sellerUsername={seller?.username ?? ""} />
                  </div>
                )}
                {order.status === "delivered" && ratedOrderIds.has(order.id) && (
                  <p className="mt-3 text-sm text-green-700">✓ You left a review for this order</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
