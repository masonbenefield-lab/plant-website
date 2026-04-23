"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { dollarsToCents } from "@/lib/stripe";

type Mode = null | "listing" | "auction" | "inventory";

export default function CreateInventoryPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length) uploadImages(files);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // shared fields
  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");

  // listing-specific
  const [price, setPrice] = useState("");

  // auction-specific
  const [startingBid, setStartingBid] = useState("");
  const [endsAt, setEndsAt] = useState("");

  async function uploadImages(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mode) return;
    setSaving(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSaving(false); return; }

    if (mode === "inventory") {
      const { error } = await supabase.from("inventory").insert({
        seller_id: user.id,
        plant_name: plantName,
        variety: variety || null,
        quantity: Number(quantity),
        description: description || null,
        images: imageUrls,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Saved to inventory!");
      router.push("/dashboard/inventory");
      return;
    }

    if (mode === "listing") {
      const { error } = await supabase.from("listings").insert({
        seller_id: user.id,
        plant_name: plantName,
        variety: variety || null,
        quantity: Number(quantity),
        price_cents: dollarsToCents(price),
        description: description || null,
        images: imageUrls,
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Listing is live in your shop!");
      router.push("/dashboard/listings");
    } else {
      const { error } = await supabase.from("auctions").insert({
        seller_id: user.id,
        plant_name: plantName,
        variety: variety || null,
        quantity: Number(quantity),
        starting_bid_cents: dollarsToCents(startingBid),
        current_bid_cents: dollarsToCents(startingBid),
        description: description || null,
        images: imageUrls,
        ends_at: new Date(endsAt).toISOString(),
      });
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Auction is live!");
      router.push("/dashboard/auctions");
    }
  }

  const sharedFieldsFilled = plantName.trim() && Number(quantity) >= 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Add Inventory</h1>
        <p className="text-muted-foreground mt-1">Fill in your item details, then choose how to sell it.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base">Item Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="plant_name">Plant Name *</Label>
                <Input
                  id="plant_name"
                  value={plantName}
                  onChange={(e) => setPlantName(e.target.value)}
                  placeholder="e.g. Monstera"
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="variety">Variety</Label>
                <Input
                  id="variety"
                  value={variety}
                  onChange={(e) => setVariety(e.target.value)}
                  placeholder="e.g. Deliciosa"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity Available *</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                required
                className="max-w-[140px]"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the plant, its condition, size, care notes…"
                rows={4}
                maxLength={1000}
              />
            </div>

            <div className="space-y-2">
              <Label>Photos</Label>
              <div
                onClick={() => !uploading && fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center cursor-pointer transition-colors ${
                  dragging
                    ? "border-green-500 bg-green-50"
                    : "border-muted-foreground/25 hover:border-green-400 hover:bg-muted/40"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {uploading ? (
                  <>
                    <span className="text-2xl">⏳</span>
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  </>
                ) : (
                  <>
                    <span className="text-3xl">📷</span>
                    <p className="text-sm font-medium">Drag & drop photos here</p>
                    <p className="text-xs text-muted-foreground">or click to browse</p>
                  </>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { if (e.target.files) uploadImages(e.target.files); }}
              />
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <img src={url} alt="" className="w-20 h-20 object-cover rounded border" />
                      <button
                        type="button"
                        onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Mode picker */}
        {!mode && (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">What do you want to do with it?</p>
            <div className="grid grid-cols-3 gap-4">
              <button
                type="button"
                disabled={!sharedFieldsFilled}
                onClick={() => setMode("listing")}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted p-8 text-center transition hover:border-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-3xl">🛒</span>
                <span className="font-semibold">List in Shop</span>
                <span className="text-xs text-muted-foreground">Set a fixed price, buyers purchase instantly</span>
              </button>
              <button
                type="button"
                disabled={!sharedFieldsFilled}
                onClick={() => setMode("auction")}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted p-8 text-center transition hover:border-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-3xl">⚡</span>
                <span className="font-semibold">Create Auction</span>
                <span className="text-xs text-muted-foreground">Set a starting bid and end time</span>
              </button>
              <button
                type="button"
                disabled={!sharedFieldsFilled}
                onClick={() => setMode("inventory")}
                className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted p-8 text-center transition hover:border-green-600 hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-3xl">📦</span>
                <span className="font-semibold">Save to Inventory</span>
                <span className="text-xs text-muted-foreground">Store for later, list or auction anytime</span>
              </button>
            </div>
            {!sharedFieldsFilled && (
              <p className="text-xs text-muted-foreground text-center">Fill in plant name and quantity above to unlock these options.</p>
            )}
          </div>
        )}

        {/* Inventory save confirm */}
        {mode === "inventory" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Save to Inventory</CardTitle>
              <CardDescription>This item will be stored in your inventory. You can list it or auction it any time from your inventory page.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => setMode(null)}>Back</Button>
                <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800">
                  {saving ? "Saving…" : "Save to Inventory"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Listing details */}
        {mode === "listing" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Shop Listing</CardTitle>
              <CardDescription>Set your price and publish to the shop.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="price">Price per item ($) *</Label>
                <Input
                  id="price"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  required
                  className="max-w-[180px]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setMode(null)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !price}
                  className="bg-green-700 hover:bg-green-800"
                >
                  {saving ? "Publishing…" : "Go Live in Shop"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Auction details */}
        {mode === "auction" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auction Details</CardTitle>
              <CardDescription>Set your starting bid and when the auction ends.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="starting_bid">Starting Bid ($) *</Label>
                <Input
                  id="starting_bid"
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={startingBid}
                  onChange={(e) => setStartingBid(e.target.value)}
                  placeholder="0.00"
                  required
                  className="max-w-[180px]"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="ends_at">Auction End Date & Time *</Label>
                <Input
                  id="ends_at"
                  type="datetime-local"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  min={new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16)}
                  required
                  className="max-w-[260px]"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setMode(null)}>
                  Back
                </Button>
                <Button
                  type="submit"
                  disabled={saving || !startingBid || !endsAt}
                  className="bg-green-700 hover:bg-green-800"
                >
                  {saving ? "Starting…" : "Start Auction"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
