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
import DisputeThread from "./dispute-thread";
import type { DisputeMessage } from "./dispute-thread";
import OrdersClient from "@/app/dashboard/orders/orders-client";
import { ExpiredAuctionBanner } from "./expired-auction-banner";

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
  refunded: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
  offered_down: "bg-gray-100 text-gray-500",
};

const PAGE_SIZE_SALES = 25;

export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; tab?: string; page?: string; id?: string }>;
}) {
  const { status = "", tab: tabParam, page: pageParam } = await searchParams;
  const activeTab = tabParam === "sales" ? "sales" : tabParam === "disputes" ? "disputes" : "purchases";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ count: pendingSalesCount }, { count: openDisputeCount }] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "paid"),
    supabase
      .from("order_disputes")
      .select("*", { count: "exact", head: true })
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .not("status", "in", '("resolved")'),
  ]);

  const tabBar = (
    <div className="flex border-b mb-6">
      {([
        { key: "purchases", label: "My Purchases", href: "/orders", badge: null },
        { key: "sales", label: "My Sales", href: "/orders?tab=sales", badge: pendingSalesCount ?? 0 },
        { key: "disputes", label: "My Disputes", href: "/orders?tab=disputes", badge: openDisputeCount ?? 0 },
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
            <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold text-white ${key === "disputes" ? "bg-red-500" : "bg-blue-500"}`}>
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
    const orderIds = orders.map((o) => o.id);
    const [{ data: listings }, { data: auctionItems }, { data: sellers }, { data: existingRatings }, { data: gardenPlants }, { data: openDisputes }] =
      await Promise.all([
        listingIds.length
          ? admin.from("listings").select("id, plant_name, variety, images, care_guide_pdf_url").in("id", listingIds)
          : { data: [] },
        auctionIds.length
          ? admin.from("auctions").select("id, plant_name, variety, images, current_bidder_id").in("id", auctionIds)
          : { data: [] },
        supabase.from("profiles").select("id, username, display_name").in("id", sellerIds),
        supabase.from("ratings").select("order_id").eq("reviewer_id", user.id),
        allListingIds.length
          ? supabase.from("garden_plants").select("source_listing_id").eq("user_id", user.id).in("source_listing_id", allListingIds)
          : { data: [] },
        orderIds.length
          ? supabase.from("order_disputes").select("id, order_id, status, reason, seller_response, created_at").in("order_id", orderIds).neq("status", "resolved")
          : { data: [] },
      ]);

    const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
    const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
    const sellerMap = Object.fromEntries((sellers ?? []).map((s) => [s.id, s]));
    const ratedOrderIds = new Set(existingRatings?.map((r) => r.order_id) ?? []);
    const inGardenListingIds = new Set(gardenPlants?.map((g) => g.source_listing_id).filter(Boolean) ?? []);
    const disputeByOrderId = Object.fromEntries((openDisputes ?? []).map((d) => [d.order_id, d]));

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
                                <Link key={ci.listing_id} href={`/shop/${ci.listing_id}`} className="font-semibold text-sm leading-snug hover:text-leaf hover:underline block">
                                  {ci.plant_name}{ci.variety ? ` — ${ci.variety}` : ""} ×{ci.quantity}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <p className="font-semibold">
                              {item
                                ? `${item.plant_name}${item.variety ? ` — ${item.variety}` : ""}`
                                : "Item details unavailable"}
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
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
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


                  {order.status === "pending" && order.auction_id && (() => {
                    const auctionForOrder = auctionMap[order.auction_id] as { id: string; current_bidder_id?: string | null } | undefined;
                    const isWinner = auctionForOrder?.current_bidder_id === user.id;
                    const deadline = (order as { payment_deadline_at?: string | null }).payment_deadline_at;
                    const deadlineDate = deadline ? new Date(deadline) : null;
                    const isExpired = deadlineDate ? deadlineDate < new Date() : false;
                    const checkoutHref = isWinner
                      ? `/checkout?auction=${order.auction_id}`
                      : `/checkout?auction=${order.auction_id}&offer=${order.id}`;
                    return (
                      <div className="mt-3 pt-3 border-t">
                        {deadlineDate && !isExpired && (
                          <p className="text-xs text-amber-600 mb-2">
                            Payment due by {deadlineDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at {deadlineDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        )}
                        {isExpired ? (
                          <p className="text-xs text-muted-foreground">Payment deadline passed — the seller has been notified.</p>
                        ) : (
                          <Link href={checkoutHref} className="inline-flex items-center justify-center h-8 px-3 text-xs font-medium rounded-md bg-leaf text-white hover:bg-forest transition-colors">
                            Complete payment →
                          </Link>
                        )}
                      </div>
                    );
                  })()}

                  {(order.status === "paid" || order.status === "shipped" || order.status === "delivered") && (
                    <div className="mt-3 pt-3 border-t">
                      <DisputeButton orderId={order.id} existingDispute={disputeByOrderId[order.id] ?? null} />
                    </div>
                  )}

                  {order.status === "delivered" && (() => {
                    const deliveredAt = (order as { delivered_at?: string | null }).delivered_at;
                    const deadline = deliveredAt ? new Date(new Date(deliveredAt).getTime() + 14 * 24 * 60 * 60 * 1000) : null;
                    const windowOpen = !deadline || new Date() <= deadline;
                    if (ratedOrderIds.has(order.id)) {
                      return <p className="mt-3 text-sm text-leaf">✓ You left a review for this order</p>;
                    }
                    if (!windowOpen) {
                      return <p className="mt-3 text-sm text-muted-foreground">Review window closed — reviews must be submitted within 14 days of delivery</p>;
                    }
                    return (
                      <div className="mt-4 pt-4 border-t">
                        {deadline && (
                          <p className="text-xs text-muted-foreground mb-2">
                            Review by {deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        )}
                        <RateSellerForm orderId={order.id} sellerUsername={seller?.username ?? ""} />
                      </div>
                    );
                  })()}

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
                              ...(seller ? { source_name: seller.display_name ?? seller.username } : {}),
                              source_listing_id: ci.listing_id,
                              order_id: order.id,
                              seller_id: order.seller_id,
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
                    if (!listingId) {
                      // Auction order — show add to garden without already-added check
                      if (!order.auction_id || !item) return null;
                      const plantName = item.plant_name ?? "";
                      const plantVariety = item.variety ?? null;
                      const auctionParams = new URLSearchParams({
                        name: plantName,
                        ...(plantVariety ? { variety: plantVariety } : {}),
                        source_type: "purchase",
                        ...(seller ? { source_name: seller.display_name ?? seller.username } : {}),
                        order_id: order.id,
                        seller_id: order.seller_id,
                      });
                      return (
                        <div className="mt-3 pt-3 border-t">
                          <Link
                            href={`/garden/new?${auctionParams.toString()}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest hover:underline"
                          >
                            🪴 Add to garden →
                          </Link>
                        </div>
                      );
                    }
                    const alreadyAdded = inGardenListingIds.has(listingId);
                    const plantName = item?.plant_name ?? "";
                    const plantVariety = item?.variety ?? null;
                    const params = new URLSearchParams({
                      name: plantName,
                      ...(plantVariety ? { variety: plantVariety } : {}),
                      source_type: "purchase",
                      ...(seller ? { source_name: seller.display_name ?? seller.username } : {}),
                      source_listing_id: listingId,
                      order_id: order.id,
                      seller_id: order.seller_id,
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

  // ── DISPUTES TAB ──────────────────────────────────────────────
  if (activeTab === "disputes") {
    const { data: disputes } = await supabase
      .from("order_disputes")
      .select("id, order_id, buyer_id, seller_id, reason, status, created_at, last_replied_at, last_replied_by_role")
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    // Auto-resolve disputes where the other party hasn't replied in 5 days
    const staleIds = (disputes ?? []).filter((d) => {
      if (d.status === "resolved" || d.status === "escalated") return false;
      const lastReplied = d.last_replied_at ? new Date(d.last_replied_at) : null;
      if (!lastReplied) return false;
      const daysSince = (Date.now() - lastReplied.getTime()) / (1000 * 60 * 60 * 24);
      return daysSince >= 5;
    }).map((d) => d.id);
    if (staleIds.length > 0) {
      await supabase.from("order_disputes").update({ status: "resolved", resolved_at: new Date().toISOString() }).in("id", staleIds);
    }

    if (!disputes?.length) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-10">
          <h1 className="text-2xl font-bold mb-4">Orders</h1>
          {tabBar}
          <div className="text-center py-16 border rounded-xl bg-muted/30">
            <p className="text-4xl mb-4">✅</p>
            <p className="font-semibold mb-1">No disputes</p>
            <p className="text-sm text-muted-foreground">You have no open or past disputes.</p>
          </div>
        </div>
      );
    }

    // Fetch orders, item names, party profiles, and messages
    const disputeOrderIds = disputes.map((d) => d.order_id);
    const partyIds = [...new Set(disputes.flatMap((d) => [d.buyer_id, d.seller_id]))];
    const disputeIds = disputes.map((d) => d.id);

    const { data: disputeOrders } = await supabase
      .from("orders")
      .select("id, amount_cents, listing_id, auction_id, cart_items")
      .in("id", disputeOrderIds);

    const dListingIds = (disputeOrders ?? []).filter((o) => o.listing_id).map((o) => o.listing_id!);
    const dAuctionIds = (disputeOrders ?? []).filter((o) => o.auction_id).map((o) => o.auction_id!);

    const [{ data: partyProfiles }, { data: dListings }, { data: dAuctions }, { data: allMessages }] = await Promise.all([
      supabase.from("profiles").select("id, username, display_name").in("id", partyIds),
      dListingIds.length ? supabase.from("listings").select("id, plant_name, variety").in("id", dListingIds) : { data: [] },
      dAuctionIds.length ? supabase.from("auctions").select("id, plant_name, variety").in("id", dAuctionIds) : { data: [] },
      supabase.from("order_dispute_messages").select("id, dispute_id, sender_id, message, images, created_at").in("dispute_id", disputeIds).order("created_at", { ascending: true }),
    ]);

    const disputeOrderMap = Object.fromEntries((disputeOrders ?? []).map((o) => [o.id, o]));
    const partyMap = Object.fromEntries((partyProfiles ?? []).map((p) => [p.id, p]));
    const dListingMap = Object.fromEntries((dListings ?? []).map((l) => [l.id, l]));
    const dAuctionMap = Object.fromEntries((dAuctions ?? []).map((a) => [a.id, a]));
    const messagesByDispute: Record<string, DisputeMessage[]> = {};
    for (const msg of allMessages ?? []) {
      if (!messagesByDispute[msg.dispute_id]) messagesByDispute[msg.dispute_id] = [];
      messagesByDispute[msg.dispute_id].push({ ...msg, images: (msg.images as string[]) ?? [] });
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-4">Orders</h1>
        {tabBar}
        <div className="space-y-4">
          {disputes.map((d) => {
            const resolvedByStale = staleIds.includes(d.id);
            const effectiveStatus = resolvedByStale ? "resolved" : d.status;
            const order = disputeOrderMap[d.order_id];
            const isBuyer = d.buyer_id === user.id;
            const buyerId = d.buyer_id;
            const sellerId = d.seller_id;
            const buyerParty = partyMap[buyerId];
            const sellerParty = partyMap[sellerId];
            const otherParty = isBuyer ? sellerParty : buyerParty;
            const buyerDisplayName = buyerParty?.display_name ?? buyerParty?.username ?? "Buyer";
            const sellerDisplayName = sellerParty?.display_name ?? sellerParty?.username ?? "Seller";

            const lastActivity = d.last_replied_at ?? d.created_at;
            const isSellersTurn = d.last_replied_by_role === "buyer" || d.last_replied_by_role === null;
            const sellerWindowExpired = Date.now() - new Date(lastActivity).getTime() >= 5 * 24 * 60 * 60 * 1000;
            const canEscalate = isBuyer &&
              effectiveStatus !== "resolved" &&
              effectiveStatus !== "escalated" &&
              isSellersTurn &&
              sellerWindowExpired;

            let itemName: string | null = null;
            if (order) {
              const cartItems = order.cart_items as { plant_name: string; variety: string | null }[] | null;
              if (cartItems?.length) {
                itemName = cartItems.map((ci) => ci.variety ? `${ci.plant_name} — ${ci.variety}` : ci.plant_name).join(", ");
              } else if (order.listing_id && dListingMap[order.listing_id]) {
                const l = dListingMap[order.listing_id];
                itemName = l.variety ? `${l.plant_name} — ${l.variety}` : l.plant_name;
              } else if (order.auction_id && dAuctionMap[order.auction_id]) {
                const a = dAuctionMap[order.auction_id];
                itemName = a.variety ? `${a.plant_name} — ${a.variety}` : a.plant_name;
              }
            }

            const messages = messagesByDispute[d.id] ?? [];

            return (
              <Card key={d.id}>
                <CardContent className="p-5 space-y-4">
                  {/* Header */}
                  <div>
                    {itemName && <p className="font-semibold">{itemName}</p>}
                    <p className="text-sm font-medium mt-0.5">{d.reason}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isBuyer ? "Seller" : "Buyer"}:{" "}
                      {otherParty?.username ? (
                        <Link href={`/sellers/${otherParty.username}`} className="text-leaf hover:underline">
                          {otherParty.display_name ?? otherParty.username}
                        </Link>
                      ) : "—"}
                      {order && <span> · {centsToDisplay(order.amount_cents)}</span>}
                      <span className="ml-2">· Filed {new Date(d.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </p>
                  </div>

                  {/* Thread */}
                  <DisputeThread
                    disputeId={d.id}
                    initialMessages={messages}
                    initialStatus={effectiveStatus}
                    initialLastRepliedByRole={d.last_replied_by_role}
                    initialLastRepliedAt={d.last_replied_at}
                    disputeCreatedAt={d.created_at}
                    currentUserId={user.id}
                    isBuyer={isBuyer}
                    buyerDisplayName={buyerDisplayName}
                    sellerDisplayName={sellerDisplayName}
                    canEscalate={canEscalate}
                  />
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

  const validStatuses = ["paid", "shipped", "delivered", "pending"];
  const activeStatus = validStatuses.includes(status) ? status : "";

  let salesQuery = supabase
    .from("orders")
    .select("*", { count: "exact" })
    .eq("seller_id", user.id)
    .order("created_at", { ascending: false });

  if (activeStatus) salesQuery = salesQuery.eq("status", activeStatus as import("@/lib/supabase/types").OrderStatus);

  const { data: salesOrders, count } = await salesQuery.range(from, to);

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

  // Fetch expired auction orders (winner didn't pay) for the action banner
  const { data: expiredAuctionOrders } = await supabase
    .from("orders")
    .select("id, buyer_id, auction_id, amount_cents")
    .eq("seller_id", user.id)
    .eq("status", "expired")
    .not("auction_id", "is", null);

  const expiredBannerData = await Promise.all(
    (expiredAuctionOrders ?? []).map(async (o) => {
      const [{ data: auction }, { data: winnerProfile }, { data: secondBid }] = await Promise.all([
        supabase.from("auctions").select("plant_name").eq("id", o.auction_id!).single(),
        supabase.from("profiles").select("username").eq("id", o.buyer_id).single(),
        supabase.from("bids").select("bidder_id").eq("auction_id", o.auction_id!).neq("bidder_id", o.buyer_id).order("amount_cents", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return {
        id: o.id,
        auctionId: o.auction_id!,
        plantName: auction?.plant_name ?? "Unknown plant",
        winningBidCents: o.amount_cents,
        winnerUsername: winnerProfile?.username ?? "Unknown buyer",
        hasSecondBidder: !!secondBid,
      };
    })
  );

  const listingIds = salesOrders.filter((o) => o.listing_id).map((o) => o.listing_id!);
  const auctionIds = salesOrders.filter((o) => o.auction_id).map((o) => o.auction_id!);
  const buyerIds = [...new Set(salesOrders.map((o) => o.buyer_id))];

  const salesOrderIds = salesOrders.map((o) => o.id);

  const [{ data: listings }, { data: auctionItems }, { data: buyers }, { data: sellerProfile }, { data: salesDisputes }] = await Promise.all([
    listingIds.length
      ? supabase.from("listings").select("id, plant_name, variety").in("id", listingIds)
      : { data: [] },
    auctionIds.length
      ? supabase.from("auctions").select("id, plant_name, variety").in("id", auctionIds)
      : { data: [] },
    supabase.from("profiles").select("id, username").in("id", buyerIds),
    supabase.from("profiles").select("auto_labels_enabled").eq("id", user.id).single(),
    salesOrderIds.length
      ? supabase.from("order_disputes").select("id, order_id, status").in("order_id", salesOrderIds).neq("status", "resolved")
      : { data: [] },
  ]);

  const listingMap = Object.fromEntries((listings ?? []).map((l) => [l.id, l]));
  const auctionMap = Object.fromEntries((auctionItems ?? []).map((a) => [a.id, a]));
  const buyerMap = Object.fromEntries((buyers ?? []).map((b) => [b.id, b]));
  const autoLabelsEnabled = (sellerProfile as { auto_labels_enabled?: boolean } | null)?.auto_labels_enabled !== false;
  const salesDisputeMap = Object.fromEntries((salesDisputes ?? []).map((d) => [d.order_id, d]));

  const statusFilters = [
    { label: "All", value: "" },
    { label: "Paid", value: "paid" },
    { label: "Shipped", value: "shipped" },
    { label: "Delivered", value: "delivered" },
  ];

  const statusParam = activeStatus ? `&status=${activeStatus}` : "";

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-4">Orders</h1>
      {tabBar}

      {/* Status filter pills */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        {statusFilters.map(({ label, value }) => {
          const isActive = activeStatus === value;
          return (
            <Link
              key={value}
              href={`/orders?tab=sales${value ? `&status=${value}` : ""}`}
              className={`text-sm px-3 py-1 rounded-full border transition-colors ${
                isActive
                  ? "bg-forest text-white border-forest"
                  : "bg-transparent text-muted-foreground border-border hover:border-forest hover:text-foreground"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>

      <ExpiredAuctionBanner orders={expiredBannerData} />

      <OrdersClient
        orders={salesOrders}
        listingMap={listingMap}
        auctionMap={auctionMap}
        buyerMap={buyerMap}
        disputeMap={salesDisputeMap}
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={PAGE_SIZE_SALES}
        prevHref={page > 1 ? `/orders?tab=sales&page=${page - 1}${statusParam}` : null}
        nextHref={page < totalPages ? `/orders?tab=sales&page=${page + 1}${statusParam}` : null}
        autoLabelsEnabled={autoLabelsEnabled}
      />
    </div>
  );
}
