import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import RateSellerForm from "./rate-seller-form";
import DisputeButton from "./dispute-button";
import OrdersClient from "@/app/dashboard/orders/orders-client";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function detectCarrier(tracking: string): string {
  if (/^1Z[0-9A-Z]{16}$/i.test(tracking)) return "UPS";
  if (/^[0-9]{20,22}$/.test(tracking) || /^9[2345][0-9]{18,}$/.test(tracking)) return "USPS";
  if (/^[0-9]{12}$/.test(tracking) || /^[0-9]{15}$/.test(tracking)) return "FedEx";
  if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(tracking)) return "USPS";
  return "Track";
}

function getCarrierUrl(tracking: string): string {
  const carrier = detectCarrier(tracking);
  if (carrier === "UPS") return `https://www.ups.com/track?tracknum=${tracking}`;
  if (carrier === "FedEx") return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${tracking}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
}

const PURCHASE_STATUS_TABS = [
  { label: "All", value: "" },
  { label: "Pending", value: "paid" },
  { label: "In Transit", value: "shipped" },
  { label: "Delivered", value: "delivered" },
] as const;

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-[#DFE7D4] text-forest",
};

const PAGE_SIZE_SALES = 25;

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string; page?: string }>;
}) {
  const { status = "", tab: tabParam, page: pageParam } = await searchParams;
  const activeTab = tabParam === "sales" ? "sales" : "purchases";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { count: pendingSalesCount } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true })
    .eq("seller_id", user.id)
    .eq("status", "paid");

  const tabBar = (
    <div className="flex border-b mb-6">
      {([
        { key: "purchases", label: "My Purchases", href: "/orders", badge: null },
        { key: "sales", label: "My Sales", href: "/orders?tab=sales", badge: pendingSalesCount ?? 0 },
      ] as const).map(({ key, label, href, badge }) => (
        <Link
          key={key}
          href={href}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === key
              ? "border-leaf text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {label}
          {badge != null && badge > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold bg-blue-500 text-white">
              {badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );

  // ── PURCHASES TAB ──────────────────────────────────────────────
  if (activeTab === "purchases") {
    let ordersQuery = supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });
    if (status) ordersQuery = ordersQuery.eq("status", status as "pending" | "paid" | "shipped" | "delivered");
    const { data: orders, error: ordersError } = await ordersQuery;
    if (ordersError) console.error("[MyOrders] query error:", ordersError.message, ordersError.code);

    const purchaseStatusBar = (
      <div className="flex gap-2 flex-wrap mb-6">
        {PURCHASE_STATUS_TABS.map(({ label, value }) => (
          <Link
            key={value}
            href={value ? `/orders?status=${value}` : "/orders"}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
              status === value
                ? "bg-leaf text-white border-leaf"
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
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-4">Orders</h1>
          {tabBar}
          {purchaseStatusBar}
          <p className="text-muted-foreground">{status ? "No orders with this status." : "No orders yet."}</p>
        </div>
      );
    }

    const listingIds = orders.filter((o) => o.listing_id).map((o) => o.listing_id!);
    const auctionIds = orders.filter((o) => o.auction_id).map((o) => o.auction_id!);
    const sellerIds = [...new Set(orders.map((o) => o.seller_id))];
    const cartListingIds = orders.flatMap((o) => {
      const items = o.cart_items as { listing_id: string }[] | null;
      return items?.map((ci) => ci.listing_id) ?? [];
    });
    const allListingIds = [...new Set([...listingIds, ...cartListingIds])];

    const admin = adminClient();
    const [{ data: listings }, { data: auctionItems }, { data: sellers }, { data: existingRatings }, { data: gardenPlants }] =
      await Promise.all([
        listingIds.length
          ? admin.from("listings").select("id, plant_name, variety, images, care_guide_pdf_url").in("id", listingIds)
          : { data: [] },
        auctionIds.length
          ? admin.from("auctions").select("id, plant_name, variety, images").in("id", auctionIds)
          : { data: [] },
        supabase.from("profiles").select("id, username, display_name").in("id", sellerIds),
        supabase.from("ratings").select("order_id").eq("reviewer_id", user.id),
        allListingIds.length
          ? supabase.from("garden_plants").select("source_listing_id").eq("user_id", user.id).in("source_listing_id", allListingIds)
          : { data: [] },
      ]);

    const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
    const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
    const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));
    const ratedOrderIds = new Set(existingRatings?.map((r) => r.order_id) ?? []);
    const inGardenListingIds = new Set(gardenPlants?.map((g) => g.source_listing_id).filter(Boolean) ?? []);

    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
        {tabBar}
        {purchaseStatusBar}
        <div className="space-y-4">
          {orders.map((order) => {
            const item = order.listing_id
              ? listingMap[order.listing_id]
              : order.auction_id
              ? auctionMap[order.auction_id]
              : null;
            const seller = sellerMap[order.seller_id];
            const cartItems = order.cart_items as { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
            const isCartOrder = !!cartItems?.length;

            return (
              <Card key={order.id}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {isCartOrder ? (
                      <div className="w-16 h-16 rounded-lg bg-muted border shrink-0 flex items-center justify-center text-2xl">🛒</div>
                    ) : (() => {
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
                          {isCartOrder ? (
                            <div>
                              {cartItems!.map((ci) => (
                                <p key={ci.listing_id} className="font-semibold text-sm leading-snug">
                                  {ci.plant_name}{ci.variety ? ` — ${ci.variety}` : ""} ×{ci.quantity}
                                </p>
                              ))}
                            </div>
                          ) : (
                            <p className="font-semibold">
                              {item?.plant_name}
                              {item?.variety ? ` — ${item.variety}` : ""}
                            </p>
                          )}
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Seller:{" "}
                            {seller?.username ? (
                              <Link href={`/sellers/${seller.username}`} className="text-leaf hover:underline">
                                {seller.display_name ?? seller.username}
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
                      Tracking:{" "}
                      <a
                        href={getCarrierUrl(order.tracking_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono font-medium text-foreground hover:text-leaf hover:underline"
                      >
                        {order.tracking_number}
                      </a>
                      <span className="ml-2 text-xs">({detectCarrier(order.tracking_number)}) ↗</span>
                    </p>
                  )}

                  {order.listing_id && (listingMap[order.listing_id] as { care_guide_pdf_url?: string | null } | null)?.care_guide_pdf_url && (
                    <p className="text-sm mt-2">
                      <a
                        href={(listingMap[order.listing_id] as { care_guide_pdf_url: string }).care_guide_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-leaf hover:underline font-medium"
                      >
                        📄 Download care guide
                      </a>
                    </p>
                  )}

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
                    <p className="mt-3 text-sm text-leaf">✓ You left a review for this order</p>
                  )}

                  {order.status === "delivered" && (() => {
                    if (isCartOrder) {
                      return (
                        <div className="mt-3 pt-3 border-t space-y-1.5">
                          {cartItems!.map((ci) => {
                            const alreadyAdded = inGardenListingIds.has(ci.listing_id);
                            const params = new URLSearchParams({
                              name: ci.plant_name,
                              ...(ci.variety ? { variety: ci.variety } : {}),
                              source_type: "purchase",
                              ...(seller?.username ? { source_name: seller.username } : {}),
                              source_listing_id: ci.listing_id,
                            });
                            return (
                              <div key={ci.listing_id} className="flex items-center gap-2">
                                <Link
                                  href={`/garden/new?${params.toString()}`}
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest hover:underline"
                                >
                                  🪴 Add {ci.plant_name}{ci.variety ? ` — ${ci.variety}` : ""} to garden →
                                </Link>
                                {alreadyAdded && (
                                  <span className="text-xs text-muted-foreground">(already in garden)</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    }
                    const listingId = order.listing_id;
                    if (!listingId) return null;
                    const alreadyAdded = inGardenListingIds.has(listingId);
                    const plantName = item?.plant_name ?? "";
                    const plantVariety = item?.variety ?? null;
                    const params = new URLSearchParams({
                      name: plantName,
                      ...(plantVariety ? { variety: plantVariety } : {}),
                      source_type: "purchase",
                      ...(seller?.username ? { source_name: seller.username } : {}),
                      source_listing_id: listingId,
                    });
                    return (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2">
                        <Link
                          href={`/garden/new?${params.toString()}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest hover:underline"
                        >
                          🪴 Add to garden →
                        </Link>
                        {alreadyAdded && (
                          <span className="text-xs text-muted-foreground">(already in garden)</span>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // ── SALES TAB ─────────────────────────────────────────────────
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const from = (page - 1) * PAGE_SIZE_SALES;
  const to = from + PAGE_SIZE_SALES - 1;

  const { data: salesOrders, count } = await supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false })
    .range(from, to);

  const total = count ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE_SALES);

  if (!salesOrders?.length) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
        {tabBar}
        <div className="text-center py-16 border rounded-xl bg-muted/30">
          <p className="text-4xl mb-4">📦</p>
          <p className="font-semibold mb-1">No sales yet</p>
          <p className="text-sm text-muted-foreground mb-6">
            Orders from buyers will appear here once someone purchases one of your listings.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/dashboard/listings" className="text-sm text-leaf hover:underline">View your listings</Link>
            <span className="text-muted-foreground">·</span>
            <Link href="/dashboard/create" className="text-sm text-leaf hover:underline">Add a listing</Link>
          </div>
        </div>
      </div>
    );
  }

  const listingIds = salesOrders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = salesOrders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const buyerIds = [...new Set(salesOrders.map((o) => o.buyer_id))];

  const [{ data: listings }, { data: auctionItems }, { data: buyers }, { data: sellerProfile }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds)
      : { data: [] },
    auctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds)
      : { data: [] },
    supabase.from("profiles").select("id, username").in("id", buyerIds),
    supabase.from("profiles").select("auto_labels_enabled").eq("id", user.id).single(),
  ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));
  const autoLabelsEnabled = (sellerProfile as { auto_labels_enabled?: boolean } | null)?.auto_labels_enabled !== false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {tabBar}
      <OrdersClient
        orders={salesOrders}
        listingMap={listingMap}
        auctionMap={auctionMap}
        buyerMap={buyerMap}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE_SALES}
        prevHref={page > 1 ? `/orders?tab=sales&page=${page - 1}` : null}
        nextHref={page < totalPages ? `/orders?tab=sales&page=${page + 1}` : null}
        autoLabelsEnabled={autoLabelsEnabled}
      />
    </div>
  );
}
