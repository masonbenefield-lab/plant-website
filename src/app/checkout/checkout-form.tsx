"use client";

import { useState } from "react";
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

interface CheckoutFormProps {
  listingId?: string;
  auctionId?: string;
  priceCents: number;
  quantity?: number;
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

export default function CheckoutForm({ listingId, auctionId, priceCents, quantity = 1 }: CheckoutFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<"address" | "payment">("address");
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState<ShippingAddress>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    zip: "",
    country: "US",
  });

  async function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listingId,
        auctionId,
        quantity,
        shippingAddress: address,
      }),
    });

    const data = await res.json();
    if (data.error) {
      toast.error(data.error);
      setLoading(false);
      return;
    }

    setClientSecret(data.clientSecret);
    setStep("payment");
    setLoading(false);
  }

  function onPaymentSuccess() {
    toast.success("Payment successful! Check your dashboard for order details.");
    router.push("/dashboard/orders");
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
          <div className="space-y-1">
            <Label htmlFor="name">Full Name</Label>
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
