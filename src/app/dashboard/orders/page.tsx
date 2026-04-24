import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import OrderStatusSelect from "./order-status-select";
import type { OrderStatus } from "@/lib/supabase/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
};

export default async function OrdersDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("*")
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (!orders?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-8">Orders</h1>
        <p className="text-muted-foreground">No orders yet.</p>
      </div>
    );
  }

  const listingIds = orders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = orders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const buyerIds = [...new Set(orders.map((o) => o.buyer_id))];

  const [{ data: listings }, { data: auctionItems }, { data: buyers }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds)
      : { data: [] },
    auctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds)
      : { data: [] },
    supabase.from("profiles").select("id, username").in("id", buyerIds),
  ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Orders</h1>
      <div className="space-y-4">
        {orders.map((order) => {
          const item = order.listing_id
            ? listingMap[order.listing_id]
            : order.auction_id
            ? auctionMap[order.auction_id]
            : null;
          const buyer = buyerMap[order.buyer_id];
          const addr = order.shipping_address as {
            name: string;
            line1: string;
            line2?: string | null;
            city: string;
            state: string;
            zip: string;
            country: string;
          };

          return (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">
                        {item?.plant_name}
                        {item?.variety ? ` — ${item.variety}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {order.auction_id ? "(auction)" : "(listing)"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">
                      Buyer: <strong>{buyer?.username}</strong> · {centsToDisplay(order.amount_cents)}
                    </p>
                    <div className="bg-muted rounded-lg p-3 text-sm">
                      <p className="font-medium mb-1">Ship to:</p>
                      <p>{addr.name}</p>
                      <p>{addr.line1}</p>
                      {addr.line2 && <p>{addr.line2}</p>}
                      <p>{addr.city}, {addr.state} {addr.zip}</p>
                      <p>{addr.country}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <Badge className={statusColors[order.status] ?? ""} variant="secondary">
                      {order.status}
                    </Badge>
                    <OrderStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
