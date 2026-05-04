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
  priceCents,
  onSuccess,
}: {
  clientSecret: string;
  priceCents: number;
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
        {loading ? "Processing…" : `Pay ${centsToDisplay(priceCents)}`}
      </Button>
    </form>
  );
}

const SAVED_ADDRESS_KEY = "checkout_saved_address";

export default function CheckoutForm({ listingId, auctionId, offerId, priceCents, quantity = 1, savedAddress }: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"address" | "payment">("address");
  const [clientSecret, setClientSecret] = useState("");
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const submittingRef = useRef(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [isGift, setIsGift] = useState(false);
  const [giftMessage, setGiftMessage] = useState("");
  const [address, setAddress] = useState<ShippingAddress>(
    savedAddress ?? { name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" }
  );

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
    if (submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);

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
      }),
    });

    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      setLoading(false);
      submittingRef.current = false;
      return;
    }

    // Save address to profile via API for cross-device persistence
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
    setClientSecret(data.clientSecret);
    setOrderId(data.orderId ?? "");
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
              priceCents={priceCents}
              onSuccess={onPaymentSuccess}
            />
          </Elements>
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
            disabled={loading}
            className="w-full bg-green-700 hover:bg-green-800 mt-2"
            size="lg"
          >
            {loading ? "Loading…" : "Continue to Payment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
