"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Plus, X, Loader2, Sprout, Search, Pencil, Check } from "lucide-react";

type Priority = "nice" | "want" | "must";

interface WishlistItem {
  id: string;
  name: string;
  variety: string | null;
  notes: string | null;
  priority: Priority | null;
  created_at: string | null;
}

const PRIORITY_LABEL: Record<Priority, string> = {
  nice: "Nice to have",
  want: "Want it",
  must: "Must have",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  nice: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  want: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  must: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
};

export function WishlistClient({ initialItems }: { initialItems: WishlistItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [q, setQ] = useState("");
  const [activeQ, setActiveQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editVariety, setEditVariety] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editPriority, setEditPriority] = useState<Priority>("want");
  const [editSaving, setEditSaving] = useState(false);

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

  function startEdit(item: WishlistItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditVariety(item.variety ?? "");
    setEditNotes(item.notes ?? "");
    setEditPriority(item.priority ?? "want");
  }

  async function handleEdit(id: string) {
    if (!editName.trim()) return;
    setEditSaving(true);
    const res = await fetch("/api/garden/wishlist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editName, variety: editVariety, notes: editNotes, priority: editPriority }),
    });
    const data = await res.json();
    setEditSaving(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
    setItems((prev) => prev.map((i) => i.id === id ? data : i));
    setEditingId(null);
    toast.success("Saved");
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    const res = await fetch(`/api/garden/wishlist?id=${id}`, { method: "DELETE" });
    setDeleting(null);
    if (!res.ok) { toast.error("Failed to remove"); return; }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Removed from wishlist");
  }

  const filtered = (activeQ.trim()
    ? items.filter((item) => {
        const text = `${item.name} ${item.variety ?? ""}`.toLowerCase();
        return text.includes(activeQ.toLowerCase());
      })
    : items
  ).slice().sort((a, b) => {
    const aKey = (a.variety || a.name).toLowerCase();
    const bKey = (b.variety || b.name).toLowerCase();
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });

  return (
    <div className="space-y-4">
      {/* Search + add row */}
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => { e.preventDefault(); setActiveQ(q); }}
      >
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search wishlist..."
            className="pl-8 pr-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf w-56"
          />
        </div>
        <button type="submit" className="px-3 py-2 text-sm rounded-lg bg-leaf text-white hover:bg-forest transition-colors font-medium">
          Search
        </button>
      </form>

      {/* Add button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border text-sm text-muted-foreground hover:border-sage hover:text-leaf transition-colors"
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
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Variety</label>
                  <input
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. Bambino"
                    className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
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
                  className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
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
                          : "border-border text-muted-foreground hover:border-sage"
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
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors"
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

      {items.length > 0 && filtered.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">No plants match &ldquo;{activeQ}&rdquo;</p>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((item) => (
            <Card key={item.id}>
              {editingId === item.id ? (
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Plant name *</label>
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">Variety</label>
                      <input
                        value={editVariety}
                        onChange={(e) => setEditVariety(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Notes</label>
                    <textarea
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Priority</label>
                    <div className="flex gap-2 flex-wrap">
                      {(["nice", "want", "must"] as Priority[]).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setEditPriority(p)}
                          className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors border",
                            editPriority === p
                              ? PRIORITY_COLOR[p] + " border-transparent"
                              : "border-border text-muted-foreground hover:border-sage"
                          )}
                        >
                          {PRIORITY_LABEL[p]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item.id)}
                      disabled={editSaving || !editName.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors"
                    >
                      {editSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-3 py-1.5 text-sm rounded-md border border-border hover:bg-muted transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-4 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm leading-tight">
                        {item.variety || item.name}
                      </p>
                      {item.variety && (
                        <p className="text-xs text-muted-foreground">{item.name}</p>
                      )}
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", item.priority ? PRIORITY_COLOR[item.priority] : "")}>
                        {item.priority ? PRIORITY_LABEL[item.priority] : ""}
                      </span>
                    </div>
                    {item.notes && (
                      <p className="text-sm text-muted-foreground leading-relaxed">{item.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      aria-label="Edit"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      disabled={deleting === item.id}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      aria-label="Remove"
                    >
                      {deleting === item.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    </button>
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
