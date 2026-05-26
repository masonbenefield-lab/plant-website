"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Gift } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function SponsorRequestForm({ hasOpenRequest }: { hasOpenRequest: boolean }) {
  const [submitted, setSubmitted] = useState(hasOpenRequest);
  const [showForm, setShowForm] = useState(false);
  const [itemName, setItemName] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim()) return;
    setSaving(true);
    const res = await fetch("/api/giveaway/sponsor-request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_name: itemName, message }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to submit"); return; }
    setSubmitted(true);
    setShowForm(false);
    toast.success("Request submitted! We'll be in touch via your messages.");
  }

  if (submitted) {
    return (
      <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
        <CardContent className="p-5 flex items-center gap-3">
          <Gift size={18} className="text-green-700 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 font-medium">
            Your sponsor request is submitted — we&apos;ll reach out via your messages inbox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-2xl border border-dashed p-6 space-y-4">
      <div className="flex items-start gap-3">
        <Gift size={20} className="text-green-700 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold">Want to donate a prize?</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            If you&apos;d like to sponsor a future giveaway by donating a plant or item, let us know. We&apos;ll reach out to coordinate.
          </p>
        </div>
      </div>

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
        >
          Submit a donation request
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">What would you like to donate? *</label>
            <input
              autoFocus
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. Variegated Monstera cutting"
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Anything else we should know? (optional)</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Size, condition, shipping notes, your shop link…"
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !itemName.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
            >
              {saving && <Loader2 size={13} className="animate-spin" />}
              Submit request
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
