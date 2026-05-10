"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { centsToDisplay } from "@/lib/stripe";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { Loader2, Package } from "lucide-react";
import { cn } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface ShippingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ShippingAddressData {
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

interface CheckoutFormProps {
  listingId?: string;
  auctionId?: string;
  offerId?: string;
  priceCents: number;
  quantity?: number;
  savedAddress?: ShippingAddressData | null;
}

function PaymentStep({
  clientSecret,
  totalCents,
  onSuccess,
}: {
  clientSecret: string;
  totalCents: number;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);

  async function handlePay(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/dashboard` },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message ?? "Payment failed");
      setLoading(false);
    } else {
      onSuccess();
    }
  }

  return (
    <form onSubmit={handlePay} className="space-y-4">
      <PaymentElement />
      <Button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-green-700 hover:bg-green-800"
        size="lg"
      >
        {loading ? "Processing…" : `Pay ${centsToDisplay(totalCents)}`}
      </Button>
    </form>
  );
}

const SAVED_ADDRESS_KEY = "checkout_saved_address";

export default function CheckoutForm({ listingId, auctionId, offerId, priceCents, quantity = 1, savedAddress }: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"address" | "shipping" | "payment">("address");
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingRates, setFetchingRates] = useState(false);
  const submittingRef = useRef(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [address, setAddress] = useState<ShippingAddress>(
    savedAddress ?? { name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" }
  );
  const [rates, setRates] = useState<ShippoRate[]>([]);
  const [selectedRate, setSelectedRate] = useState<ShippoRate | null>(null);
  const [totalCents, setTotalCents] = useState(priceCents);

  // Fall back to localStorage if no server-side saved address
  useEffect(() => {
    if (savedAddress) return;
    try {
      const stored = localStorage.getItem(SAVED_ADDRESS_KEY);
      if (stored) setAddress(JSON.parse(stored));
    } catch { /* ignore */ }
  }, [savedAddress]);

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isGift && giftMessage) {
      const hit = findProhibitedWord(giftMessage);
      if (hit) {
        toast.error(`Your gift message contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "gift-message", giftMessage);
        return;
      }
    }
    setFetchingRates(true);

    const res = await fetch("/api/shipping/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        auctionId,
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

    if (data.error) {
      toast.error(data.error);
      return;
    }

    setRates(data.rates ?? []);
    setSelectedRate(data.rates?.[0] ?? null);
    const firstRateCents = data.rates?.[0] ? Math.round(parseFloat(data.rates[0].amount) * 100) : 0;
    setTotalCents(priceCents + firstRateCents);
    setStep("shipping");

    // Save address
    if (saveAddress) {
      fetch("/api/profile/save-address", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      }).catch(() => {});
      try { localStorage.setItem(SAVED_ADDRESS_KEY, JSON.stringify(address)); } catch { /* ignore */ }
    } else {
      try { localStorage.removeItem(SAVED_ADDRESS_KEY); } catch { /* ignore */ }
    }
  }

  async function handleShippingSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRate || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

    const shippingCostCents = Math.round(parseFloat(selectedRate.amount) * 100);
    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        auctionId,
        offerId,
        quantity,
        shippingAddress: isGift
          ? { ...address, is_gift: true, gift_message: giftMessage || null }
          : address,
        shippingCostCents,
        shippoRateId: selectedRate.objectId,
        shippingService: selectedRate.servicelevelName,
      }),
    });

    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    setClientSecret(data.clientSecret);
    setOrderId(data.orderId ?? "");
    setTotalCents(priceCents + shippingCostCents);
    setStep("payment");
    setLoading(false);
  }

  function onPaymentSuccess() {
    router.push(orderId ? `/orders/confirmed?id=${orderId}` : "/orders");
  }

  if (step === "payment" && clientSecret) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <PaymentStep
              clientSecret={clientSecret}
              totalCents={totalCents}
              onSuccess={onPaymentSuccess}
            />
          </Elements>
        </CardContent>
      </Card>
    );
  }

  if (step === "shipping") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Choose Shipping</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleShippingSubmit} className="space-y-4">
            <div className="space-y-2">
              {rates.map((rate) => {
                const rateCents = Math.round(parseFloat(rate.amount) * 100);
                const isSelected = selectedRate?.objectId === rate.objectId;
                return (
                  <label
                    key={rate.objectId}
                    className={cn(
                      "flex items-center gap-4 rounded-lg border p-4 cursor-pointer transition-colors",
                      isSelected ? "border-green-600 bg-green-50 dark:bg-green-900/20" : "hover:bg-muted"
                    )}
                    onClick={() => {
                      setSelectedRate(rate);
                      setTotalCents(priceCents + rateCents);
                    }}
                  >
                    <input
                      type="radio"
                      name="shipping-rate"
                      value={rate.objectId}
                      checked={isSelected}
                      onChange={() => {
                        setSelectedRate(rate);
                        setTotalCents(priceCents + rateCents);
                      }}
                      className="accent-green-700"
                    />
                    <Package size={18} className="text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">{rate.provider} — {rate.servicelevelName}</p>
                      {rate.estimatedDays != null && (
                        <p className="text-xs text-muted-foreground">Est. {rate.estimatedDays} business day{rate.estimatedDays !== 1 ? "s" : ""}</p>
                      )}
                    </div>
                    <span className="text-sm font-semibold shrink-0">{centsToDisplay(rateCents)}</span>
                  </label>
                );
              })}
            </div>

            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Item{quantity > 1 ? `s (×${quantity})` : ""}</span>
                <span>{centsToDisplay(priceCents)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Shipping</span>
                <span>{selectedRate ? centsToDisplay(Math.round(parseFloat(selectedRate.amount) * 100)) : "—"}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                <span>Total</span>
                <span>{centsToDisplay(totalCents)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setStep("address")}
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={loading || !selectedRate}
                className="flex-1 bg-green-700 hover:bg-green-800"
              >
                {loading ? "Loading…" : "Continue to Payment"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shipping Address</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddressSubmit} className="space-y-4">
          {/* Gift option */}
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isGift}
              onChange={(e) => setIsGift(e.target.checked)}
              className="rounded"
            />
            <span>🎁 Send as a gift</span>
          </label>
          {isGift && (
            <div className="space-y-1">
              <Label htmlFor="gift-message">Gift Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="gift-message"
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="Add a personal note to the recipient…"
                rows={2}
                maxLength={300}
              />
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="name">{isGift ? "Recipient's Full Name" : "Full Name"}</Label>
            <Input
              id="name"
              value={address.name}
              onChange={(e) => setAddress({ ...address, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="line1">Address Line 1</Label>
            <Input
              id="line1"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="line2">Address Line 2</Label>
            <Input
              id="line2"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              placeholder="Apt, suite, unit, etc. (optional)"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input
                id="state"
                value={address.state}
                onChange={(e) => setAddress({ ...address, state: e.target.value })}
                required
                maxLength={2}
                placeholder="TX"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="zip">ZIP Code</Label>
              <Input
                id="zip"
                value={address.zip}
                onChange={(e) => setAddress({ ...address, zip: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={address.country}
                onChange={(e) => setAddress({ ...address, country: e.target.value })}
                required
                maxLength={2}
                placeholder="US"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={saveAddress}
              onChange={(e) => setSaveAddress(e.target.checked)}
              className="rounded"
            />
            Save this address for next time
          </label>
          <Button
            type="submit"
            disabled={fetchingRates}
            className="w-full bg-green-700 hover:bg-green-800 mt-2"
            size="lg"
          >
            {fetchingRates ? (
              <span className="flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Fetching shipping rates…</span>
            ) : "Continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
