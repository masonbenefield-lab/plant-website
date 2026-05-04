"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { centsToDisplay } from "@/lib/stripe";
import { Pagination } from "@/components/pagination";
import OrderStatusSelect from "./order-status-select";
import TrackingInput from "./tracking-input";
import { BulkOrderActions, OrderCheckbox } from "./bulk-order-actions";
import type { OrderStatus } from "@/lib/supabase/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  paid: "bg-blue-100 text-blue-800",
  shipped: "bg-purple-100 text-purple-800",
  delivered: "bg-green-100 text-green-800",
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
};

type ItemRow = { id: string; plant_name: string; variety: string | null };
type BuyerRow = { id: string; username: string };

export default function OrdersClient({
  orders,
  listingMap,
  auctionMap,
  buyerMap,
  page,
  totalPages,
  total,
  pageSize,
}: {
  orders: OrderRow[];
  listingMap: Record<string, ItemRow>;
  auctionMap: Record<string, ItemRow>;
  buyerMap: Record<string, BuyerRow>;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
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
            className="h-4 w-4 rounded border-gray-300 accent-green-700 cursor-pointer"
          />
          Select all
        </label>
      </div>

      {selectedIds.length > 0 && (
        <BulkOrderActions selectedIds={selectedIds} onClear={() => setSelectedIds([])} />
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const item = order.listing_id
            ? listingMap[order.listing_id]
            : order.auction_id
            ? auctionMap[order.auction_id]
            : null;
          const buyer = buyerMap[order.buyer_id];
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
                            <span className="font-semibold">
                              {item?.plant_name}{item?.variety ? ` — ${item.variety}` : ""}
                            </span>
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
                      <OrderStatusSelect orderId={order.id} currentStatus={order.status as OrderStatus} />
                    </div>
                  </div>
                </div>
                <div className="mt-3 ml-7">
                  <TrackingInput orderId={order.id} initialValue={order.tracking_number ?? null} />
                </div>
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
        prevHref={page > 1 ? `/dashboard/orders?page=${page - 1}` : null}
        nextHref={page < totalPages ? `/dashboard/orders?page=${page + 1}` : null}
      />
    </div>
  );
}
