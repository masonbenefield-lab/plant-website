"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function ReserveOfferActions({
  auctionId,
  offerStatus,
  expired,
}: {
  auctionId: string;
  offerStatus: string | null;
  expired: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (expired || offerStatus === "expired") {
    return (
      <div className="rounded-xl border border-muted bg-muted/40 px-5 py-4 text-center text-sm text-muted-foreground">
        This offer has expired. Contact the seller if you&apos;re still interested.
      </div>
    );
  }

  if (offerStatus === "accepted") {
    return (
      <div className="rounded-xl border border-leaf bg-[#EBF0E6] dark:bg-forest/20 px-5 py-4 text-center text-sm font-medium text-forest dark:text-[#A8BF9A]">
        ✓ You accepted this offer. Your order is being processed.
      </div>
    );
  }

  if (offerStatus === "declined") {
    return (
      <div className="rounded-xl border border-muted bg-muted/40 px-5 py-4 text-center text-sm text-muted-foreground">
        You declined this offer.
      </div>
    );
  }

  async function respond(action: "accept" | "decline") {
    setLoading(true);
    try {
      const res = await fetch("/api/auctions/reserve-offer/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, action }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Something went wrong");
        return;
      }
      if (action === "accept") {
        if (data.paymentFailed) {
          toast.error("Payment failed — please update your card and try again.");
          router.push("/account#bidding");
        } else {
          toast.success("Purchase confirmed — your card has been charged!");
          router.push("/orders");
        }
      } else {
        toast.info("Offer declined.");
        router.push("/auctions");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-center text-muted-foreground">
        Your saved card will be charged automatically when you confirm. This cannot be undone.
      </p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          disabled={loading}
          onClick={() => respond("decline")}
        >
          Decline
        </Button>
        <Button
          className="flex-1 bg-leaf hover:bg-forest"
          disabled={loading}
          onClick={() => respond("accept")}
        >
          {loading ? "Processing…" : "Confirm Purchase"}
        </Button>
      </div>
    </div>
  );
}
