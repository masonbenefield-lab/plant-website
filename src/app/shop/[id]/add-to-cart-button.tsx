"use client";

import { useState } from "react";
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
  maxQty: number;
  bundleDiscountPct?: number | null;
}) {
  const { addItem, openCart } = useCart();
  const [qty] = useState(1);

  function handleAdd() {
    if (qty > maxQty) { toast.error("Not enough stock"); return; }
    const result = addItem({ listingId, plantName, variety, priceCents, quantity: qty, imageUrl, sellerId, sellerUsername, bundleDiscountPct: bundleDiscountPct ?? null });
    if (result === "seller_conflict") {
      toast.error("Your cart already has items from another seller. Clear your cart first.");
    } else if (result === "updated") {
      toast.success("Quantity updated in cart");
      openCart();
    } else {
      toast.success("Added to cart!");
      openCart();
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleAdd}
      className="w-full flex items-center gap-2"
    >
      <ShoppingCart size={16} />
      Add to Cart
    </Button>
  );
}
