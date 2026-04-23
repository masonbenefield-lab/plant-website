"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { toast } from "sonner";

export default function RateSellerForm({
  orderId,
  sellerUsername,
}: {
  orderId: string;
  sellerUsername: string;
}) {
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) return toast.error("Please select a star rating");
    setSaving(true);

    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, score, comment }),
    });
    const data = await res.json();

    setSaving(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success(`Review submitted for ${sellerUsername}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium">Rate {sellerUsername}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setScore(n)}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                n <= (hover || score)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        maxLength={500}
      />
      <Button
        type="submit"
        size="sm"
        disabled={saving}
        className="bg-green-700 hover:bg-green-800"
      >
        {saving ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
