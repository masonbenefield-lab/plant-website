"use client";

import { Button } from "@/components/ui/button";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";

export default function AddToCartButton({
  listingId,
  plantName,
  variety,
  priceCents,
  imageUrl,
  sellerId,
  sellerUsername,
  sellerDisplayName,
  maxQty,
  bundleDiscountPct,
}: {
  listingId: string;
  plantName: string;
  variety: string | null;
  priceCents: number;
  imageUrl: string | null;
  sellerId: string;
  sellerUsername: string;
  sellerDisplayName: string;
  maxQty: number;
  bundleDiscountPct?: number | null;
}) {
  const { addItem, openCart, items } = useCart();
  const inCart = items.find((i) => i.listingId === listingId)?.quantity ?? 0;
  const atMax = inCart >= maxQty;

  function handleAdd() {
    if (atMax) { toast.error("You've already added all available stock"); return; }
    const result = addItem({ listingId, plantName, variety, priceCents, quantity: 1, imageUrl, sellerId, sellerUsername, sellerDisplayName, bundleDiscountPct: bundleDiscountPct ?? null, maxQty });
    if (result === "seller_conflict") {
      toast.error("Your cart already has items from another seller. Clear your cart first.");
    } else {
      openCart();
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleAdd}
      disabled={atMax}
      className="w-full flex items-center gap-2"
    >
      <ShoppingCart size={16} />
      {atMax ? "Max quantity in cart" : "Add to Cart"}
    </Button>
  );
}
