"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { useCart } from "@/lib/cart";
import type { CartItem } from "@/lib/cart";

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
  buyerNotePrompt,
  buyerNoteRequired,
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
  buyerNotePrompt?: string | null;
  buyerNoteRequired?: boolean;
}) {
  const { addItem, clearCart, openCart, items, sellerDisplayName: cartSellerName } = useCart();
  const [showConflict, setShowConflict] = useState(false);
  const [buyerNote, setBuyerNote] = useState("");
  const inCart = items.find((i) => i.listingId === listingId)?.quantity ?? 0;
  const atMax = inCart >= maxQty;

  const pendingItem: CartItem = {
    listingId, plantName, variety, priceCents, quantity: 1,
    imageUrl, sellerId, sellerUsername, sellerDisplayName,
    bundleDiscountPct: bundleDiscountPct ?? null, maxQty,
    buyerNote: buyerNote.trim() || null,
    buyerNotePrompt: buyerNotePrompt ?? null,
    buyerNoteRequired: buyerNoteRequired ?? false,
  };

  function handleAdd() {
    if (atMax) return;
    if (buyerNoteRequired && !buyerNote.trim()) {
      toast.error("Please add a note for the seller");
      return;
    }
    const result = addItem(pendingItem);
    if (result === "seller_conflict") {
      setShowConflict(true);
    } else {
      openCart();
    }
  }

  function handleClearAndAdd() {
    clearCart();
    addItem(pendingItem);
    setShowConflict(false);
    openCart();
  }

  return (
    <>
      {buyerNotePrompt && (
        <div className="space-y-1">
          <Label htmlFor="cart-buyer-note">
            {buyerNoteRequired ? (
              <>{buyerNotePrompt} <span className="text-destructive">*</span></>
            ) : (
              <>{buyerNotePrompt} <span className="text-muted-foreground text-xs">(optional)</span></>
            )}
          </Label>
          <Textarea
            id="cart-buyer-note"
            value={buyerNote}
            onChange={(e) => setBuyerNote(e.target.value)}
            placeholder={buyerNotePrompt}
            rows={2}
            maxLength={500}
          />
        </div>
      )}
      <Button
        variant="outline"
        onClick={handleAdd}
        disabled={atMax}
        className="w-full flex items-center gap-2"
      >
        <ShoppingCart size={16} />
        {atMax ? "Max quantity in cart" : "Add to Cart"}
      </Button>

      <Dialog open={showConflict} onOpenChange={setShowConflict}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Different seller in cart</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Your cart already has items from <strong>{cartSellerName ?? "another seller"}</strong>. Plantet only supports purchasing from one seller at a time.
          </p>
          <p className="text-sm text-muted-foreground">
            Would you like to clear your current cart and add <strong>{plantName}{variety ? ` — ${variety}` : ""}</strong> instead?
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowConflict(false)}>Keep my cart</Button>
            <Button className="bg-leaf hover:bg-forest" onClick={handleClearAndAdd}>Clear cart & add this</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
