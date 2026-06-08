"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface RecipientProfile {
  id: string;
  username: string;
  display_name: string | null;
}

export default function NewTradePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const toUsername = searchParams.get("to");

  const [recipient, setRecipient] = useState<RecipientProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [offerDescription, setOfferDescription] = useState("");
  const [wantDescription, setWantDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!toUsername) { setNotFound(true); return; }
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("username", toUsername)
      .single()
      .then(({ data }) => {
        if (data) setRecipient(data);
        else setNotFound(true);
      });
  }, [toUsername]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipient) return;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/trades", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: recipient.id,
        offerDescription,
        wantDescription,
      }),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    router.push(`/trades/${json.tradeId}`);
  }

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center">
        <p className="text-muted-foreground mb-4">Grower not found.</p>
        <Link href="/gardens" className="text-sm text-leaf hover:underline">
          ← Browse Gardens
        </Link>
      </div>
    );
  }

  if (!recipient) {
    return (
      <div className="max-w-lg mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  const displayName = recipient.display_name || recipient.username;

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <Link
        href={`/gardens/${recipient.username}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ChevronLeft size={16} />
        {displayName}&apos;s Garden
      </Link>

      <div className="flex items-center gap-2 mb-2">
        <ArrowLeftRight size={20} className="text-leaf" />
        <h1 className="text-2xl font-bold">Propose a Trade</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Tell <strong>{displayName}</strong> what you&apos;re offering and what you&apos;d like in return.
      </p>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5">
                What you&apos;re offering
              </label>
              <textarea
                value={offerDescription}
                onChange={(e) => setOfferDescription(e.target.value)}
                placeholder="e.g. Monstera Thai Constellation cutting, well-rooted in 4" pot"
                rows={3}
                maxLength={500}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
              />
              <p className="text-xs text-muted-foreground text-right mt-0.5">
                {offerDescription.length}/500
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5">
                What you want from {displayName}
              </label>
              <textarea
                value={wantDescription}
                onChange={(e) => setWantDescription(e.target.value)}
                placeholder="e.g. Looking for a Philodendron White Princess or similar rare Philodendron"
                rows={3}
                maxLength={500}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
              />
              <p className="text-xs text-muted-foreground text-right mt-0.5">
                {wantDescription.length}/500
              </p>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !offerDescription.trim() || !wantDescription.trim()}
              className="w-full py-2.5 rounded-lg bg-leaf text-white font-semibold text-sm hover:bg-forest transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send Trade Proposal"}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
