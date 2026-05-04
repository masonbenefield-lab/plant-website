"use client";

import Link from "next/link";
import Image from "next/image";
import { X, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { centsToDisplay } from "@/lib/stripe";
import { useCart, effectivePrice } from "@/lib/cart";

export function CartButton() {
  const { count, openCart } = useCart();
  return (
    <button
      onClick={openCart}
      className="relative p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      title="Cart"
    >
      <ShoppingCart size={17} />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 bg-green-700 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, clearCart, totalCents, sellerUsername } = useCart();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-background shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-lg">Your Cart</h2>
          <button onClick={closeCart} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Your cart is empty
          </div>
        ) : (
          <>
            {sellerUsername && (
              <p className="px-5 pt-3 text-xs text-muted-foreground">
                From{" "}
                <Link href={`/sellers/${sellerUsername}`} onClick={closeCart} className="text-green-700 hover:underline font-medium">
                  {sellerUsername}
                </Link>
                {" "}— items from one seller per cart
              </p>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {items.map((item) => (
                <div key={item.listingId} className="flex gap-3 items-start">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.plantName}
                      width={56}
                      height={56}
                      className="rounded-md object-cover border shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-md bg-muted border shrink-0 flex items-center justify-center text-xl">🌿</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {item.plantName}{item.variety ? ` — ${item.variety}` : ""}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-sm text-green-700 font-semibold">{centsToDisplay(effectivePrice(item))}</p>
                      {item.bundleDiscountPct && item.quantity >= 2 && (
                        <span className="text-xs text-purple-600 font-medium">{item.bundleDiscountPct}% bundle deal</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <button
                        onClick={() => updateQty(item.listingId, item.quantity - 1)}
                        className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-sm w-5 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.listingId, item.quantity + 1)}
                        className="w-6 h-6 rounded border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        onClick={() => removeItem(item.listingId)}
                        className="ml-auto text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="px-5 py-4 border-t space-y-3">
              <div className="flex justify-between text-sm font-medium">
                <span>Total</span>
                <span className="text-green-700 text-base font-bold">{centsToDisplay(totalCents)}</span>
              </div>
              <Link href="/checkout/cart" onClick={closeCart}>
                <Button className="w-full bg-green-700 hover:bg-green-800" size="lg">
                  Checkout
                </Button>
              </Link>
              <button
                onClick={clearCart}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
              >
                Clear cart
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
