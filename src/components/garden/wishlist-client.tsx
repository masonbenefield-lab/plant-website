"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, X, Loader2, Sprout } from "lucide-react";

type Priority = "nice" | "want" | "must";

interface WishlistItem {
  id: string;
  name: string;
  variety: string | null;
  notes: string | null;
  priority: Priority;
  created_at: string;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  nice: "Nice to have",
  want: "Want it",
  must: "Must have",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  nice: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  want: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  must: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
};

export function WishlistClient({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [variety, setVariety] = useState("");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("want");

  function resetForm() {
    setName("");
    setVariety("");
    setNotes("");
    setPriority("want");
    setShowForm(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const res = await fetch("/api/garden/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, variety, notes, priority }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to add"); return; }
    setItems((prev) => [data, ...prev]);
    toast.success("Added to wishlist");
    resetForm();
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/garden/wishlist?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { toast.error("Failed to remove"); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removed from wishlist");
  }

  return (
    <div className="space-y-4">
      {/* Add button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors"
        >
          <Plus size={16} />
          Add plant to wishlist
        </button>
      ) : (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleAdd} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Plant name *</label>
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Fiddle Leaf Fig"
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Variety</label>
                  <input
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. Bambino"
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Where to find it, why you want it…"
                  rows={2}
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Priority</label>
                <div className="flex gap-2 flex-wrap">
                  {(["nice", "want", "must"] as Priority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                        priority === p
                          ? PRIORITY_COLOR[p] + " border-transparent"
                          : "border-border text-muted-foreground hover:border-green-400"
                      )}
                    >
                      {PRIORITY_LABEL[p]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={saving || !name.trim()}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Add to wishlist
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">Your wishlist is empty</p>
            <p className="text-sm text-muted-foreground">
              Keep track of plants you want to grow someday.
            </p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm leading-tight">
                      {item.variety || item.name}
                    </p>
                    {item.variety && (
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    )}
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLOR[item.priority])}>
                      {PRIORITY_LABEL[item.priority]}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.notes}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  disabled={deleting === item.id}
                  className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remove"
                >
                  {deleting === item.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
