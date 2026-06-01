"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Priority = "nice" | "want" | "must";

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: "nice", label: "Nice to have" },
  { value: "want", label: "Want it" },
  { value: "must", label: "Must have" },
];

interface Props {
  plantName: string;
  variety?: string | null;
  /** Pre-populated ID if the item is already in the user's wishlist. */
  initialSavedId?: string | null;
  /** Render as a small overlay icon (for image cards). Default: false (inline button). */
  overlay?: boolean;
}

export function SaveToWishlistButton({ plantName, variety, initialSavedId, overlay = false }: Props) {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(!!initialSavedId);
  const [savedItemId, setSavedItemId] = useState<string | null>(initialSavedId ?? null);
  const [name, setName] = useState(plantName);
  const [varietyVal, setVarietyVal] = useState(variety ?? "");
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState<Priority>("want");
  const [loading, setLoading] = useState(false);

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    if (saved) {
      handleUnsave(e);
      return;
    }
    setOpen(true);
  }

  async function handleUnsave(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!savedItemId) return;
    setLoading(true);
    const res = await fetch(`/api/garden/wishlist?id=${savedItemId}`, { method: "DELETE" });
    const data = await res.json();
    setLoading(false);
    if (data.error) { toast.error(data.error); return; }
    setSaved(false);
    setSavedItemId(null);
    toast.success("Removed from your wishlist");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/garden/wishlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        variety: varietyVal.trim() || null,
        notes: notes.trim() || null,
        priority,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.error) {
      toast.error(data.error);
      return;
    }
    setSaved(true);
    setSavedItemId(data.id);
    setOpen(false);
    toast.success("Added to your wishlist!", {
      action: {
        label: "View Wishlist",
        onClick: () => { window.location.href = "/garden/wishlist"; },
      },
    });
  }

  return (
    <>
      {overlay ? (
        <button
          type="button"
          onClick={handleOpen}
          disabled={loading}
          aria-label={saved ? "Remove from wishlist" : "Save to my wishlist"}
          className={cn(
            "p-1.5 rounded-full transition-all shadow-sm",
            saved
              ? "bg-leaf text-white hover:bg-red-500"
              : "bg-black/40 text-white hover:bg-black/60"
          )}
        >
          {saved ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleOpen}
          disabled={loading}
          aria-label={saved ? "Remove from wishlist" : "Save to my wishlist"}
          className={cn(
            "p-2 rounded-full border transition-all shrink-0",
            saved
              ? "border-leaf text-leaf bg-[#EBF0E6] dark:bg-forest/20 hover:border-red-300 hover:text-red-500 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-950/30"
              : "border-input text-muted-foreground hover:text-leaf hover:border-leaf"
          )}
        >
          {saved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
        </button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save to My Wishlist</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label htmlFor="wl-name">Plant name</Label>
              <Input
                id="wl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-variety">
                Variety{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="wl-variety"
                value={varietyVal}
                onChange={(e) => setVarietyVal(e.target.value)}
                placeholder="e.g. Thai Constellation"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex gap-2">
                {PRIORITIES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setPriority(value)}
                    className={cn(
                      "flex-1 text-xs px-2 py-1.5 rounded-md border font-medium transition-colors",
                      priority === value
                        ? "border-leaf bg-[#EBF0E6] text-leaf dark:bg-forest/20 dark:border-forest dark:text-sage"
                        : "border-input hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="wl-notes">
                Notes{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="wl-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Why you want it, where you saw it…"
                rows={2}
                className="resize-none"
              />
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-leaf hover:bg-forest"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin mr-2" />
                  Saving…
                </>
              ) : (
                "Save to wishlist"
              )}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
