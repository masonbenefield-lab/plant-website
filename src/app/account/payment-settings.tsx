"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CreditCard, MapPin, ExternalLink } from "lucide-react";

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
    <div className="space-y-6">
      <CardSection card={card} onRemoved={() => setCard(null)} />
      <ShippingSection address={shippingAddress} onSaved={setShippingAddress} />
    </div>
  );
}

function CardSection({
  card,
  onRemoved,
}: {
  card: CardInfo | null;
  onRemoved: () => void;
}) {
  const [redirecting, setRedirecting] = useState(false);

  async function handleSetupCard() {
    setRedirecting(true);
    try {
      const res = await fetch("/api/stripe/setup-session", { method: "POST" });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? `Server error (${res.status})`);
        setRedirecting(false);
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start card setup. Please try again.");
      setRedirecting(false);
    }
  }

  async function handleRemove() {
    if (!confirm("Remove your saved card?")) return;
    await fetch("/api/stripe/buyer-profile", { method: "DELETE" });
    onRemoved();
    toast.success("Card removed");
  }

  return (
    <div className="rounded-xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <CreditCard size={16} className="text-muted-foreground" />
        <h3 className="font-semibold text-sm">Payment Method</h3>
      </div>

      {card ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">
              {card.brand} •••• {card.last4}
            </p>
            <p className="text-xs text-muted-foreground">Expires {card.expMonth}/{card.expYear}</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleSetupCard} disabled={redirecting}>
              {redirecting ? "Redirecting…" : "Update"}
            </Button>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            No payment method saved. Add a card to bid on auctions.
          </p>
          <p className="text-xs text-muted-foreground">
            Your card will be charged automatically if you win an auction. Card details are entered
            securely on Stripe&apos;s site — we never see your card number.
          </p>
          <Button
            size="sm"
            onClick={handleSetupCard}
            disabled={redirecting}
            className="bg-leaf hover:bg-forest gap-1.5"
          >
            <ExternalLink size={13} />
            {redirecting ? "Redirecting to Stripe…" : "Save card securely via Stripe"}
          </Button>
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
      const validRes = await fetch("/api/address/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const { valid, messages } = await validRes.json();
      if (!valid) {
        toast.error(messages?.length ? messages.join(" ") : "Address could not be verified. Please check and try again.");
        setSaving(false);
        return;
      }

      const res = await fetch("/api/stripe/buyer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shippingAddress: form }),
      });
      if (!res.ok) throw new Error("Failed to save address");
      onSaved(form);
      toast.success("Delivery address saved");
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
