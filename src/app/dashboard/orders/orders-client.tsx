"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { Pagination } from "@/components/pagination";
import OrderStatusSelect from "./order-status-select";
import TrackingInput from "./tracking-input";
import { BulkOrderActions, OrderCheckbox, type BulkOrderInfo } from "./bulk-order-actions";
import type { OrderStatus } from "@/lib/supabase/types";
import { toast } from "sonner";
import { Printer, ExternalLink, AlertTriangle } from "lucide-react";
import GetLabelModal from "./get-label-modal";

function detectCarrier(tracking: string): string {
  if (/^1Z[0-9A-Z]{16}$/i.test(tracking)) return "UPS";
  if (/^[0-9]{20,22}$/.test(tracking) || /^9[2345][0-9]{18,}$/.test(tracking)) return "USPS";
  if (/^[0-9]{12}$/.test(tracking) || /^[0-9]{15}$/.test(tracking)) return "FedEx";
  if (/^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(tracking)) return "USPS";
  return "Carrier";
}

function getCarrierUrl(tracking: string): string {
  const carrier = detectCarrier(tracking);
  if (carrier === "UPS") return `https://www.ups.com/track?tracknum=${tracking}`;
  if (carrier === "FedEx") return `https://www.fedex.com/apps/fedextrack/?tracknumbers=${tracking}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${tracking}`;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-[#DFE7D4] text-forest",
  refunded: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
  offered_down: "bg-gray-100 text-gray-500",
};

type OrderRow = {
  id: string;
  listing_id: string | null;
  auction_id: string | null;
  buyer_id: string;
  amount_cents: number;
  status: string;
  shipping_address: unknown;
  cart_items: unknown;
  tracking_number: string | null;
  shippo_rate_id: string | null;
  label_url: string | null;
  shipping_cost_cents: number | null;
  shipping_service: string | null;
  created_at: string;
};

type ItemRow = { id: string; plant_name: string; variety: string | null };
type BuyerRow = { id: string; username: string };

function BuyLabelButton({ orderId, labelUrl: initialLabelUrl, createdAt }: { orderId: string; labelUrl: string | null; createdAt: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [labelUrl, setLabelUrl] = useState(initialLabelUrl);
  const [useModal, setUseModal] = useState(false);

  const ageMs = Date.now() - new Date(createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  const daysLeft = Math.max(0, 7 - ageDays);
  const rateExpired = ageDays >= 7;
  const rateExpiringSoon = !rateExpired && ageDays >= 5;

  if (labelUrl) {
    return (
      <a
        href={labelUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-leaf hover:text-forest hover:underline"
      >
        <Printer size={13} /> View label
      </a>
    );
  }

  async function handleBuyLabel() {
    setLoading(true);
    const res = await fetch("/api/shipping/purchase-label", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) {
      const isStaleRate = /phone|email or phone/i.test(data.error);
      if (isStaleRate) {
        setUseModal(true);
        toast.info("Re-select a shipping rate to get your label.");
      } else {
        toast.error(data.error);
      }
      return;
    }
    setLabelUrl(data.labelUrl);
    router.refresh();
    toast.success("Label purchased!", {
      description: "Tracking number added. Click 'View label' to print.",
    });
    if (data.labelUrl) window.open(data.labelUrl, "_blank");
  }

  if (useModal) {
    return <GetLabelModal orderId={orderId} initialLabelUrl={labelUrl} />;
  }

  if (rateExpired) {
    return (
      <p className="text-xs text-red-600 font-medium">
        Shipping rate expired — enter tracking manually after shipping
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1.5"
        disabled={loading}
        onClick={handleBuyLabel}
      >
        <Printer size={13} />
        {loading ? "Purchasing…" : "Buy Label"}
      </Button>
      {rateExpiringSoon && (
        <p className="text-xs text-amber-600 font-medium">
          Rate expires in ~{Math.ceil(daysLeft)} day{Math.ceil(daysLeft) !== 1 ? "s" : ""} — buy soon
        </p>
      )}
    </div>
  );
}

type DisputeRow = {
  id: string;
  order_id: string;
  status: string;
};

const DISPUTE_COLOR: Record<string, string> = {
  seller_notified: "text-amber-600",
  seller_responded: "text-blue-600",
  escalated: "text-red-600",
};
const DISPUTE_LABEL: Record<string, string> = {
  seller_notified: "Dispute filed — respond in My Disputes",
  seller_responded: "Dispute active — view in My Disputes",
  escalated: "Escalated to Plantet",
};

function DisputePanel({ dispute }: { dispute: DisputeRow }) {
  if (dispute.status === "resolved") return null;
  const color = DISPUTE_COLOR[dispute.status] ?? "text-amber-600";
  const label = DISPUTE_LABEL[dispute.status] ?? "Dispute open";
  return (
    <div className="mt-3 pt-3 border-t border-amber-200">
      <Link href="/orders?tab=disputes" className={`flex items-center gap-1.5 text-xs font-medium hover:underline ${color}`}>
        <AlertTriangle size={12} />
        {label}
      </Link>
    </div>
  );
}

export default function OrdersClient({
  orders,
  listingMap,
  auctionMap,
  buyerMap,
  disputeMap = {},
  page,
  totalPages,
  total,
  pageSize,
  prevHref,
  nextHref,
  autoLabelsEnabled = true,
}: {
  orders: OrderRow[];
  listingMap: Record<string, ItemRow>;
  auctionMap: Record<string, ItemRow>;
  buyerMap: Record<string, BuyerRow>;
  disputeMap?: Record<string, DisputeRow>;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
  autoLabelsEnabled?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleOrder(id: string) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    if (selectedIds.length === orders.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(orders.map(o => o.id));
    }
  }

  function buildBulkOrderInfo(): BulkOrderInfo[] {
    return orders
      .filter((o) => selectedIds.includes(o.id))
      .map((o) => {
        const cartItems = o.cart_items as { plant_name: string; variety: string | null; quantity: number }[] | null;
        let label: string;
        if (cartItems?.length) {
          label = cartItems.map((ci) => `${ci.plant_name}${ci.variety ? ` — ${ci.variety}` : ""} ×${ci.quantity}`).join(", ");
        } else {
          const item = o.listing_id ? listingMap[o.listing_id] : o.auction_id ? auctionMap[o.auction_id] : null;
          label = item ? `${item.plant_name}${item.variety ? ` — ${item.variety}` : ""}` : o.id.slice(0, 8);
        }
        return { id: o.id, label, status: o.status };
      });
  }

  return (
    <div className="space-y-4">
      {/* Bulk actions bar */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
          <input
            type="checkbox"
            checked={selectedIds.length === orders.length && orders.length > 0}
            ref={(el) => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < orders.length; }}
            onChange={toggleAll}
            className="h-4 w-4 rounded border-gray-300 accent-leaf cursor-pointer"
          />
          Select all
        </label>
      </div>

      {selectedIds.length > 0 && (
        <BulkOrderActions selectedOrders={buildBulkOrderInfo()} onClear={() => setSelectedIds([])} />
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const item = order.listing_id
            ? listingMap[order.listing_id]
            : order.auction_id
            ? auctionMap[order.auction_id]
            : null;
          const buyer = buyerMap[order.buyer_id];
          const dispute = disputeMap[order.id];
          const addr = order.shipping_address as {
            name: string; line1: string; line2?: string | null;
            city: string; state: string; zip: string; country: string;
            is_gift?: boolean; gift_message?: string | null;
          };
          const cartItems = order.cart_items as { listing_id: string; plant_name: string; variety: string | null; quantity: number; price_cents: number }[] | null;
          const isCartOrder = !!cartItems?.length;

          return (
            <Card key={order.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <OrderCheckbox orderId={order.id} selectedIds={selectedIds} onToggle={toggleOrder} />
                  <div className="flex-1 flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {isCartOrder ? (
                          cartItems!.map((ci) => (
                            <span key={ci.listing_id} className="font-semibold">
                              {ci.plant_name}{ci.variety ? ` — ${ci.variety}` : ""} ×{ci.quantity}
                            </span>
                          ))
                        ) : (
                          <>
                            {order.auction_id ? (
                              <Link href={`/auctions/${order.auction_id}`} className="font-semibold hover:underline underline-offset-2">
                                {item?.plant_name}{item?.variety ? ` — ${item.variety}` : ""}
                              </Link>
                            ) : (
                              <span className="font-semibold">
                                {item?.plant_name}{item?.variety ? ` — ${item.variety}` : ""}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {order.auction_id ? "(auction)" : "(listing)"}
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Buyer: <strong>{buyer?.username}</strong> · {centsToDisplay(order.amount_cents)}
                      </p>
                      <div className="bg-muted rounded-lg p-3 text-sm">
                        <p className="font-medium mb-1">
                          Ship to:{addr.is_gift && <span className="ml-2 text-xs bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 px-1.5 py-0.5 rounded-full font-medium">🎁 Gift</span>}
                        </p>
                        <p>{addr.name}</p>
                        <p>{addr.line1}</p>
                        {addr.line2 && <p>{addr.line2}</p>}
                        <p>{addr.city}, {addr.state} {addr.zip}</p>
                        <p>{addr.country}</p>
                        {addr.gift_message && (
                          <p className="mt-2 pt-2 border-t border-border/50 italic text-muted-foreground">"{addr.gift_message}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-3">
                      <Badge className={statusColors[order.status] ?? ""} variant="secondary">
                        {order.status}
                      </Badge>
                      <OrderStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} trackingNumber={order.tracking_number} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 ml-7 space-y-2">
                  {order.shipping_cost_cents != null && order.shipping_cost_cents > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Shipping: {centsToDisplay(order.shipping_cost_cents)}{order.shipping_service ? ` · ${order.shipping_service}` : ""}
                    </p>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <TrackingInput orderId={order.id} initialValue={order.tracking_number ?? null} />
                    {autoLabelsEnabled && order.shippo_rate_id && (
                      <BuyLabelButton orderId={order.id} labelUrl={order.label_url} createdAt={order.created_at} />
                    )}
                  </div>
                  {order.tracking_number && (
                    <a
                      href={getCarrierUrl(order.tracking_number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-leaf hover:text-forest hover:underline mt-1"
                    >
                      <ExternalLink size={11} />
                      Track with {detectCarrier(order.tracking_number)}
                    </a>
                  )}
                </div>
                {dispute && <DisputePanel dispute={dispute} />}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        pageSize={pageSize}
        prevHref={prevHref}
        nextHref={nextHref}
      />
    </div>
  );
}
