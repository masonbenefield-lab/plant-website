"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import BuyButton from "./buy-button";
import AddToCartButton from "./add-to-cart-button";

export default function ListingActions({
  listingId,
  maxQty,
  plantName,
  variety,
  priceCents,
  imageUrl,
  sellerId,
  sellerUsername,
  sellerDisplayName,
  bundleDiscountPct,
  buyerNotePrompt,
  buyerNoteRequired,
}: {
  listingId: string;
  maxQty: number;
  plantName: string;
  variety: string | null;
  priceCents: number;
  imageUrl: string | null;
  sellerId: string;
  sellerUsername: string;
  sellerDisplayName: string;
  bundleDiscountPct?: number | null;
  buyerNotePrompt?: string | null;
  buyerNoteRequired?: boolean;
}) {
  const [buyerNote, setBuyerNote] = useState("");

  return (
    <div className="space-y-3">
      {buyerNotePrompt && (
        <div className="space-y-1">
          <Label htmlFor="buyer-note">
            {buyerNotePrompt}{" "}
            {buyerNoteRequired
              ? <span className="text-destructive">*</span>
              : <span className="text-muted-foreground text-xs">(optional)</span>}
          </Label>
          <Textarea
            id="buyer-note"
            value={buyerNote}
            onChange={(e) => setBuyerNote(e.target.value)}
            placeholder={buyerNotePrompt}
            rows={2}
            maxLength={500}
          />
        </div>
      )}
      <BuyButton
        listingId={listingId}
        maxQty={maxQty}
        buyerNote={buyerNote}
        buyerNoteRequired={buyerNoteRequired}
      />
      <AddToCartButton
        listingId={listingId}
        plantName={plantName}
        variety={variety}
        priceCents={priceCents}
        imageUrl={imageUrl}
        sellerId={sellerId}
        sellerUsername={sellerUsername}
        sellerDisplayName={sellerDisplayName}
        maxQty={maxQty}
        bundleDiscountPct={bundleDiscountPct}
        buyerNote={buyerNote}
        buyerNotePrompt={buyerNotePrompt}
        buyerNoteRequired={buyerNoteRequired}
      />
    </div>
  );
}
