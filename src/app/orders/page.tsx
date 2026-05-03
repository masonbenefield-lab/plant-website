import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import RateSellerForm from "./rate-seller-form";
import DisputeButton from "./dispute-button";

const STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "In Transit", value: "shipped" },
  { label: "Delivered", value: "delivered" },
] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
};

export default async function MyOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status = "" } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let ordersQuery = supabase
    .from("orders")
    .select("*")
    .eq("buyer_id", user.id)
    .order("created_at", { ascending: false });
  if (status) ordersQuery = ordersQuery.eq("status", status as "pending" | "paid" | "shipped" | "delivered");
  const { data: orders } = await ordersQuery;

  const tabBar = (
    <div className="flex gap-2 flex-wrap mb-6">
      {STATUS_TABS.map(({ label, value }) => (
        <Link
          key={value}
          href={value ? `/orders?status=${value}` : "/orders"}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
            status === value
              ? "bg-green-700 text-white border-green-700"
              : "text-muted-foreground border-border hover:border-foreground hover:text-foreground"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );

  if (!orders?.length) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-6">My Orders</h1>
        {tabBar}
        <p className="text-muted-foreground">{status ? "No orders with this status." : "No orders yet."}</p>
      </div>
    );
  }

  const listingIds = orders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = orders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const sellerIds = [...new Set(orders.map((o) => o.seller_id))];

  const [{ data: listings }, { data: auctionItems }, { data: sellers }, { data: existingRatings }] =
    await Promise.all([
      listingIds.length
        ? supabase.from("listings").select("id, plant_name, variety, images").in("id", listingIds)
        : { data: [] },
      auctionIds.length
        ? supabase.from("auctions").select("id, plant_name, variety, images").in("id", auctionIds)
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
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>
      {tabBar}
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
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  {(() => {
                    const img = (item as { images?: string[] } | null)?.images?.[0];
                    return img ? (
                      <Link href={order.listing_id ? `/shop/${order.listing_id}` : `/auctions/${order.auction_id}`}>
                        <Image
                          src={img}
                          alt={item?.plant_name ?? ""}
                          width={64}
                          height={64}
                          className="rounded-lg object-cover border shrink-0 hover:opacity-90 transition-opacity"
                        />
                      </Link>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-muted border shrink-0 flex items-center justify-center text-2xl">🌿</div>
                    );
                  })()}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">
                          {item?.plant_name}
                          {item?.variety ? ` — ${item.variety}` : ""}
                        </p>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Seller:{" "}
                          {seller?.username ? (
                            <Link href={`/sellers/${seller.username}`} className="text-green-700 hover:underline">
                              {seller.username}
                            </Link>
                          ) : "—"}
                          {" "}· {centsToDisplay(order.amount_cents)}
                        </p>
                      </div>
                      <Badge className={statusColors[order.status] ?? ""} variant="secondary">
                        {order.status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {order.tracking_number && (
                  <p className="text-sm mt-3 pt-3 border-t text-muted-foreground">
                    Tracking: <span className="font-mono font-medium text-foreground">{order.tracking_number}</span>
                  </p>
                )}

                {/* Dispute button — visible on paid/shipped/delivered orders */}
                {(order.status === "paid" || order.status === "shipped" || order.status === "delivered") && (
                  <div className="mt-3 pt-3 border-t">
                    <DisputeButton orderId={order.id} />
                  </div>
                )}

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
