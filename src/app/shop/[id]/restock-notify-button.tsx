"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export default function RestockNotifyButton({
  listingId,
  isLoggedIn,
  alreadySubscribed,
}: {
  listingId: string;
  isLoggedIn: boolean;
  alreadySubscribed: boolean;
}) {
  const [done, setDone] = useState(alreadySubscribed);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [showEmail, setShowEmail] = useState(false);

  async function subscribe(emailOverride?: string) {
    setLoading(true);
    const res = await fetch("/api/restock-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, email: emailOverride }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    setDone(true);
    toast.success("We'll email you when this comes back in stock!");
  }

  if (done) {
    return (
      <p className="text-sm text-muted-foreground">
        ✓ You'll be notified when this restocks
      </p>
    );
  }

  if (!isLoggedIn && showEmail) {
    return (
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={loading || !email}
          onClick={() => subscribe(email)}
        >
          {loading ? "…" : "Notify me"}
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={loading}
      onClick={() => isLoggedIn ? subscribe() : setShowEmail(true)}
    >
      {loading ? "Subscribing…" : "🔔 Notify me when restocked"}
    </Button>
  );
}
