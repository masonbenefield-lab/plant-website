"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function BuyButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleBuy() {
    setLoading(true);
    router.push(`/checkout?listing=${listingId}`);
  }

  return (
    <Button
      onClick={handleBuy}
      disabled={loading}
      className="bg-green-700 hover:bg-green-800 w-full"
      size="lg"
    >
      {loading ? "Loading…" : "Buy Now"}
    </Button>
  );
}
