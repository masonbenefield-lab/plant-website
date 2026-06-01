"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
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
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
const SAVED_ADDRESS_KEY = "checkout_saved_address";

interface ShippingAddress {
  name: string; line1: string; line2: string; city: string; state: string; zip: string; country: string;
}

interface ShippoRate {
  objectId: string;
  provider: string;
  servicelevelName: string;
  servicelevelToken: string;
  amount: string;
  currency: string;
  estimatedDays: number | null;
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
      <Button type="submit" disabled={loading || !stripe} className="w-full bg-leaf hover:bg-forest" size="lg">
        {loading ? "Processing…" : `Pay ${centsToDisplay(totalCents)}`}
      </Button>
    </form>
  );
}

export default function CartCheckoutPage() {
  const { items, totalCents: itemsTotalCents, clearCart } = useCart();
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const [step, setStep] = useState<"address" | "shipping" | "payment">("address");
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [saveAddress, setSaveAddress] = useState(true);
  const [address, setAddress] = useState<ShippingAddress>({ name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" });
  const [rates, setRates] = useState<ShippoRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippoRate | null>(null);
  const [grandTotalCents, setGrandTotalCents] = useState(itemsTotalCents);
  const [flatShippingCents, setFlatShippingCents] = useState<number | null>(null);
  const [extraFlatCents, setExtraFlatCents] = useState(0);
  const [taxCents, setTaxCents] = useState(0);

  useEffect(() => {
    setGrandTotalCents(itemsTotalCents);
  }, [itemsTotalCents]);

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
        <Link href="/shop" className="text-leaf hover:underline">Browse the shop →</Link>
      </div>
    );
  }

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isGift && giftMessage) {
      const hit = findProhibitedWord(giftMessage);
      if (hit) {
        toast.error(`Your gift message contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "gift-message-cart", giftMessage);
        return;
      }
    }
    setFetchingRates(true);

    const res = await fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingIds: items.map((i) => i.listingId),
        toAddress: {
          name: address.name,
          street1: address.line1,
          street2: address.line2 || null,
          city: address.city,
          state: address.state,
          zip: address.zip,
          country: address.country,
        },
      }),
    });

    const data = await res.json();
    setFetchingRates(false);

    if (data.error) { toast.error(data.error); return; }

    if (saveAddress) {
      try { localStorage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(address)); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(SAVED_ADDRESS_KEY); } catch { /* ignore */ }
    }

    if (data.freeShipping) {
      await createCartOrder({ shippingCostCents: 0 });
      return;
    }

    if (data.flatRate) {
      setFlatShippingCents(data.flatRateCents);
      setGrandTotalCents(itemsTotalCents + data.flatRateCents);
      await createCartOrder({ shippingCostCents: data.flatRateCents });
      return;
    }

    const extra = data.extraFlatCents ?? 0;
    setExtraFlatCents(extra);
    setRates(data.rates ?? []);
    const first = data.rates?.[0] ?? null;
    setSelectedRate(first);
    const firstCents = first ? Math.round(parseFloat(first.amount) * 100) : 0;
    setGrandTotalCents(itemsTotalCents + firstCents + extra);
    setStep("shipping");
  }

  async function createCartOrder({ shippingCostCents, shippoRateId, shippingService }: { shippingCostCents: number; shippoRateId?: string; shippingService?: string }) {
    setLoading(true);
    const res = await fetch("/api/stripe/cart-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({ listingId: i.listingId, quantity: i.quantity, priceCents: i.priceCents })),
        shippingAddress: isGift ? { ...address, is_gift: true, gift_message: giftMessage || null } : address,
        shippingCostCents,
        shippoRateId,
        shippingService,
      }),
    });

    const data = await res.json();
    if (data.error) { toast.error(data.error); setLoading(false); return; }

    const tax = data.taxCents ?? 0;
    setClientSecret(data.clientSecret);
    setOrderId(data.orderId ?? "");
    setTaxCents(tax);
    setGrandTotalCents(itemsTotalCents + shippingCostCents + tax);
    setStep("payment");
    setLoading(false);
  }

  async function handleShippingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRate) return;
    await createCartOrder({
      shippingCostCents: Math.round(parseFloat(selectedRate.amount) * 100) + extraFlatCents,
      shippoRateId: selectedRate.objectId,
      shippingService: selectedRate.servicelevelName,
    });
  }

  function onPaymentSuccess() {
    clearCart();
    router.push(orderId ? `/orders/confirmed?id=${orderId}` : "/orders");
  }

  // Order summary sidebar
  const OrderSummary = () => (
    <div className="space-y-3">
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
      <div className="border-t pt-3 space-y-1 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Items</span>
          <span>{centsToDisplay(itemsTotalCents)}</span>
        </div>
        {selectedRate ? (
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{centsToDisplay(Math.round(parseFloat(selectedRate.amount) * 100) + extraFlatCents)}</span>
          </div>
        ) : flatShippingCents !== null ? (
          <div className="flex justify-between text-muted-foreground">
            <span>Shipping</span>
            <span>{centsToDisplay(flatShippingCents)}</span>
          </div>
        ) : null}
        {taxCents > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Tax</span>
            <span>{centsToDisplay(taxCents)}</span>
          </div>
        )}
        <div className="flex justify-between font-semibold pt-1 border-t">
          <span>Total</span>
          <span className="text-leaf">{centsToDisplay(grandTotalCents)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
        <div className="md:col-span-2">
          <OrderSummary />
        </div>

        <div className="md:col-span-3">
          {step === "payment" && clientSecret ? (
            <Card>
              <CardHeader><CardTitle>Payment</CardTitle></CardHeader>
              <CardContent>
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: resolvedTheme === "dark" ? "night" : "stripe" } }}>
                  <PaymentStep clientSecret={clientSecret} totalCents={grandTotalCents} onSuccess={onPaymentSuccess} />
                </Elements>
              </CardContent>
            </Card>
          ) : step === "shipping" ? (
            <Card>
              <CardHeader><CardTitle>Choose Shipping</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleShippingSubmit} className="space-y-4">
                  <div className="space-y-2">
                    {rates.map((rate) => {
                      const rateCents = Math.round(parseFloat(rate.amount) * 100);
                      const totalShippingCents = rateCents + extraFlatCents;
                      const isSelected = selectedRate?.objectId === rate.objectId;
                      return (
                        <label
                          key={rate.objectId}
                          className={cn(
                            "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                            isSelected ? "border-leaf bg-[#EBF0E6] dark:bg-forest/20" : "hover:bg-muted"
                          )}
                          onClick={() => {
                            setSelectedRate(rate);
                            setGrandTotalCents(itemsTotalCents + totalShippingCents);
                          }}
                        >
                          <input
                            type="radio"
                            name="shipping-rate"
                            value={rate.objectId}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedRate(rate);
                              setGrandTotalCents(itemsTotalCents + totalShippingCents);
                            }}
                            className="accent-leaf"
                          />
                          <Package size={18} className="text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold">{rate.provider} — {rate.servicelevelName}</p>
                            {rate.estimatedDays != null && (
                              <p className="text-xs text-muted-foreground">Est. {rate.estimatedDays} business day{rate.estimatedDays !== 1 ? "s" : ""}</p>
                            )}
                          </div>
                          <span className="text-sm font-semibold shrink-0">{centsToDisplay(totalShippingCents)}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex gap-3">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("address")}>Back</Button>
                    <Button type="submit" disabled={loading || !selectedRate} className="flex-1 bg-leaf hover:bg-forest">
                      {loading ? "Loading…" : "Continue to Payment"}
                    </Button>
                  </div>
                </form>
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
                  <Button type="submit" disabled={fetchingRates} className="w-full bg-leaf hover:bg-forest mt-2" size="lg">
                    {fetchingRates ? (
                      <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Fetching shipping rates…</span>
                    ) : "Continue"}
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
