"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, MapPin } from "lucide-react";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface CardInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export default function PaymentSettings() {
  const [card, setCard] = useState<CardInfo | null>(null);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stripe/buyer-profile")
      .then((r) => r.json())
      .then((data) => {
        setCard(data.card ?? null);
        setShippingAddress(data.shippingAddress ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-muted" />;

  return (
    <div id="payment" className="space-y-6">
      <Elements stripe={stripePromise}>
        <CardSection card={card} onSaved={setCard} />
      </Elements>
      <ShippingSection address={shippingAddress} onSaved={setShippingAddress} />
    </div>
  );
}

function CardSection({ card, onSaved }: { card: CardInfo | null; onSaved: (c: CardInfo) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!stripe || !elements) return;
    setSaving(true);
    try {
      const res = await fetch("/api/stripe/setup-intent", { method: "POST" });
      const { clientSecret } = await res.json();

      const cardEl = elements.getElement(CardElement);
      if (!cardEl) throw new Error("Card element not found");

      const { setupIntent, error } = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardEl },
      });

      if (error) throw new Error(error.message);
      if (!setupIntent?.payment_method) throw new Error("Setup failed");

      const pmId = typeof setupIntent.payment_method === "string"
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

      const patchRes = await fetch("/api/stripe/buyer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId: pmId }),
      });
      if (!patchRes.ok) throw new Error("Failed to save card");

      // Refresh card info
      const profileRes = await fetch("/api/stripe/buyer-profile");
      const data = await profileRes.json();
      if (data.card) onSaved(data.card);

      toast.success("Card saved");
      setAdding(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save card");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your saved card?")) return;
    await fetch("/api/stripe/buyer-profile", { method: "DELETE" });
    toast.success("Card removed");
    window.location.reload();
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-muted-foreground" />
        <h3 className="font-semibold text-sm">Payment Method</h3>
      </div>

      {card && !adding ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">
              {card.brand} •••• {card.last4}
            </p>
            <p className="text-xs text-muted-foreground">Expires {card.expMonth}/{card.expYear}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>Update</Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemove}>Remove</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {!adding ? (
            <p className="text-sm text-muted-foreground">No payment method saved. Add a card to bid on auctions.</p>
          ) : null}
          {adding && (
            <div className="rounded-md border border-input bg-background px-3 py-2.5">
              <CardElement options={{ style: { base: { fontSize: "14px" } } }} />
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Your card will be charged automatically if you win an auction.
          </p>
          <div className="flex gap-2">
            {adding ? (
              <>
                <Button size="sm" onClick={handleSave} disabled={saving} className="bg-leaf hover:bg-forest">
                  {saving ? "Saving…" : "Save card"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setAdding(false)}>Cancel</Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setAdding(true)} className="bg-leaf hover:bg-forest">
                Add card
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShippingSection({
  address,
  onSaved,
}: {
  address: ShippingAddress | null;
  onSaved: (a: ShippingAddress) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<ShippingAddress>(
    address ?? { name: "", line1: "", line2: "", city: "", state: "", zip: "", country: "US" }
  );

  useEffect(() => {
    if (address) setForm(address);
  }, [address]);

  async function handleSave() {
    if (!form.name || !form.line1 || !form.city || !form.state || !form.zip || !form.country) {
      toast.error("Please fill in all required address fields");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/stripe/buyer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: form }),
      });
      if (!res.ok) throw new Error("Failed to save address");
      onSaved(form);
      toast.success("Shipping address saved");
      setEditing(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save address");
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof ShippingAddress, required = false, half = false) {
    return (
      <div className={`space-y-1 ${half ? "col-span-1" : "col-span-2"}`}>
        <Label htmlFor={key}>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
        <Input
          id={key}
          value={form[key] ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <MapPin size={16} className="text-muted-foreground" />
        <h3 className="font-semibold text-sm">Delivery Address</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Where your winnings ship to. Required for weight-based shipping auctions and used for automatic checkout.
      </p>

      {address && !editing ? (
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm leading-relaxed">
            {address.name}<br />
            {address.line1}{address.line2 ? `, ${address.line2}` : ""}<br />
            {address.city}, {address.state} {address.zip}<br />
            {address.country}
          </p>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>Edit</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {field("Full Name", "name", true)}
            {field("Address Line 1", "line1", true)}
            {field("Address Line 2", "line2", false)}
            {field("City", "city", true, true)}
            {field("State", "state", true, true)}
            {field("ZIP Code", "zip", true, true)}
            {field("Country", "country", true, true)}
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-leaf hover:bg-forest">
              {saving ? "Saving…" : "Save address"}
            </Button>
            {address && (
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
