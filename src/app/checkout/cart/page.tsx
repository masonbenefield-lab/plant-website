"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { redirect } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { centsToDisplay } from "@/lib/stripe";
import { useCart } from "@/lib/cart";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const SAVED_ADDRESS_KEY = "checkout_saved_address";

interface ShippingAddress {
  name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string;
}

function PaymentStep({ clientSecret, totalCents, onSuccess }: { clientSecret: string; totalCents: number; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/orders` },
      redirect: "if_required",
    });
    if (error) { toast.error(error.message ?? "Payment failed"); setLoading(false); }
    else onSuccess();
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <Button type="submit" disabled={loading || !stripe} className="w-full bg-green-700 hover:bg-green-800" size="lg">
        {loading ? "Processing…" : `Pay ${centsToDisplay(totalCents)}`}
      </Button>
    </form>
  );
}

export default function CartCheckoutPage() {
  const { items, totalCents, clearCart } = useCart();
  const router = useRouter();
  const [step, setStep] = useState<"address" | "payment">("address");
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [address, setAddress] = useState<ShippingAddress>({ name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" });

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SAVED_ADDRESS_KEY);
      if (stored) setAddress(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  if (items.length === 0 && step === "address") {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty.</p>
        <Link href="/shop" className="text-green-700 hover:underline">Browse the shop →</Link>
      </div>
    );
  }

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/stripe/cart-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity, priceCents: i.priceCents })),
        shippingAddress: isGift ? { ...address, is_gift: true, gift_message: giftMessage || null } : address,
      }),
    });

    const data = await res.json();
    if (data.error) { toast.error(data.error); setLoading(false); return; }

    if (saveAddress) {
      try { localStorage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(address)); } catch { /* ignore */ }
    }

    setClientSecret(data.clientSecret);
    setOrderId(data.orderId ?? "");
    setStep("payment");
    setLoading(false);
  }

  function onPaymentSuccess() {
    clearCart();
    router.push(orderId ? `/orders/confirmed?id=${orderId}` : "/orders");
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        {/* Order summary */}
        <div className="md:col-span-2 space-y-3">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Order Summary</h2>
          {items.map((item) => (
            <div key={item.listingId} className="flex gap-3 items-center">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={item.plantName} width={48} height={48} className="rounded-md object-cover border shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-muted border shrink-0 flex items-center justify-center text-lg">🌿</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight">{item.plantName}{item.variety ? ` — ${item.variety}` : ""}</p>
                <p className="text-xs text-muted-foreground">Qty {item.quantity} · {centsToDisplay(item.priceCents)}</p>
              </div>
            </div>
          ))}
          <div className="border-t pt-3 flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-green-700">{centsToDisplay(totalCents)}</span>
          </div>
        </div>

        {/* Form */}
        <div className="md:col-span-3">
          {step === "payment" && clientSecret ? (
            <Card>
              <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                  <PaymentStep clientSecret={clientSecret} totalCents={totalCents} onSuccess={onPaymentSuccess} />
                </Elements>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader><CardTitle>Shipping Address</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAddressSubmit} className="space-y-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} className="rounded" />
                    <span>🎁 Send as a gift</span>
                  </label>
                  {isGift && (
                    <div className="space-y-1">
                      <Label htmlFor="gift-message">Gift Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
                      <Textarea id="gift-message" value={giftMessage} onChange={(e) => setGiftMessage(e.target.value)} placeholder="Add a personal note…" rows={2} maxLength={300} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label htmlFor="name">{isGift ? "Recipient's Full Name" : "Full Name"}</Label>
                    <Input id="name" value={address.name} onChange={(e) => setAddress({ ...address, name: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line1">Address Line 1</Label>
                    <Input id="line1" value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="line2">Address Line 2</Label>
                    <Input id="line2" value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Apt, suite, unit, etc. (optional)" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="city">City</Label>
                      <Input id="city" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="state">State</Label>
                      <Input id="state" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} required maxLength={2} placeholder="TX" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="zip">ZIP Code</Label>
                      <Input id="zip" value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="country">Country</Label>
                      <Input id="country" value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} required maxLength={2} placeholder="US" />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="rounded" />
                    Save this address for next time
                  </label>
                  <Button type="submit" disabled={loading} className="w-full bg-green-700 hover:bg-green-800 mt-2" size="lg">
                    {loading ? "Loading…" : "Continue to Payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
