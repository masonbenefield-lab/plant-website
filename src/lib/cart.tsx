"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

export interface CartItem {
  listingId: string;
  plantName: string;
  variety: string | null;
  priceCents: number;
  quantity: number;
  imageUrl: string | null;
  sellerId: string;
  sellerUsername: string;
  bundleDiscountPct: number | null;
}

export function effectivePrice(item: CartItem): number {
  if (item.bundleDiscountPct && item.quantity >= 2) {
    return Math.round(item.priceCents * (1 - item.bundleDiscountPct / 100));
  }
  return item.priceCents;
}

interface CartContextValue {
  items: CartItem[];
  sellerId: string | null;
  sellerUsername: string | null;
  addItem: (item: CartItem) => "added" | "seller_conflict" | "updated";
  removeItem: (listingId: string) => void;
  updateQty: (listingId: string, qty: number) => void;
  clearCart: () => void;
  totalCents: number;
  count: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "plantet_cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setItems(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  function persist(next: CartItem[]) {
    setItems(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const addItem = useCallback((item: CartItem): "added" | "seller_conflict" | "updated" => {
    let result: "added" | "seller_conflict" | "updated" = "added";
    setItems((prev) => {
      // If cart has items from a different seller, reject
      if (prev.length > 0 && prev[0].sellerId !== item.sellerId) {
        result = "seller_conflict";
        return prev;
      }
      const existing = prev.find((i) => i.listingId === item.listingId);
      let next: CartItem[];
      if (existing) {
        result = "updated";
        next = prev.map((i) =>
          i.listingId === item.listingId ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      } else {
        next = [...prev, item];
      }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    return result;
  }, []);

  const removeItem = useCallback((listingId: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.listingId !== listingId);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const updateQty = useCallback((listingId: string, qty: number) => {
    setItems((prev) => {
      const next = qty <= 0
        ? prev.filter((i) => i.listingId !== listingId)
        : prev.map((i) => i.listingId === listingId ? { ...i, quantity: qty } : i);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const totalCents = items.reduce((sum, i) => sum + effectivePrice(i) * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);
  const sellerId = items[0]?.sellerId ?? null;
  const sellerUsername = items[0]?.sellerUsername ?? null;

  return (
    <CartContext.Provider value={{
      items, sellerId, sellerUsername,
      addItem, removeItem, updateQty, clearCart,
      totalCents, count,
      isOpen, openCart: () => setIsOpen(true), closeCart: () => setIsOpen(false),
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
