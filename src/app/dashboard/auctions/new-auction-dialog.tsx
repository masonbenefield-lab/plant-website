"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/compress-image";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { dollarsToCents } from "@/lib/stripe";
import PriceSuggestion from "@/components/price-suggestion";
import PotSizePicker from "@/components/pot-size-picker";
import { PLANT_CATEGORIES } from "@/lib/categories";

interface PrefillData {
  id: string;
  plant_name: string;
  variety: string | null;
  quantity: number;
  description: string | null;
  images: string[];
  starting_bid_cents: number;
  buy_now_price_cents: number | null;
  reserve_price_cents: number | null;
  category: string | null;
  pot_size: string | null;
  free_shipping: boolean;
  shipping_cost_cents: number | null;
  shipping_weight_oz: number | null;
}

interface Props {
  sellerId: string;
  planLimit: number | null;
  currentCount: number;
  photoLimit: number | null;
  calculatedShippingEnabled: boolean;
  prefill?: PrefillData;
  triggerLabel?: string;
  keepOriginal?: boolean;
}

export default function NewAuctionDialog({ sellerId, planLimit, currentCount, photoLimit, calculatedShippingEnabled, prefill, triggerLabel, keepOriginal }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(prefill?.images ?? []);
  const [plantName, setPlantName] = useState(prefill?.plant_name ?? "");
  const [variety, setVariety] = useState(prefill?.variety ?? "");
  const [potSize, setPotSize] = useState(prefill?.pot_size ?? "");
  const [category, setCategory] = useState(prefill?.category ?? "");
  const [shippingMode, setShippingMode] = useState<"" | "free" | "flat" | "weight">(
    prefill ? (prefill.free_shipping ? "free" : prefill.shipping_weight_oz ? "weight" : prefill.shipping_cost_cents ? "flat" : "") : ""
  );
  const [startingBidVal, setStartingBidVal] = useState(prefill ? prefill.starting_bid_cents / 100 : 0);
  const [buyNowVal, setBuyNowVal] = useState(prefill ? (prefill.buy_now_price_cents ?? 0) / 100 : 0);
  const [reserveVal, setReserveVal] = useState(prefill ? (prefill.reserve_price_cents ?? 0) / 100 : 0);
  const [startsAt, setStartsAt] = useState("");

  function handleStartsAtChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (!val) { setStartsAt(""); return; }
    const ms15 = 15 * 60 * 1000;
    const snapped = new Date(Math.round(new Date(val).getTime() / ms15) * ms15);
    const local = new Date(snapped.getTime() - snapped.getTimezoneOffset() * 60000);
    setStartsAt(local.toISOString().slice(0, 16));
  }
  const fileRef = useRef<HTMLInputElement>(null);

  const buyNowError = buyNowVal > 0 && startingBidVal > 0 && buyNowVal <= startingBidVal;
  const reserveError = (reserveVal > 0 && startingBidVal > 0 && reserveVal < startingBidVal)
    || (reserveVal > 0 && buyNowVal > 0 && reserveVal >= buyNowVal);

  const atAuctionLimit = planLimit !== null && currentCount >= planLimit;
  const atPhotoLimit = photoLimit !== null && imageUrls.length >= photoLimit;

  async function uploadImages(files: FileList) {
    if (atPhotoLimit) {
      toast.error(`Your plan allows ${photoLimit} photo${photoLimit === 1 ? "" : "s"} per listing.`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const remaining = photoLimit !== null ? photoLimit - imageUrls.length : Infinity;
    const toUpload = Array.from(files).slice(0, remaining);
    if (fileRef.current) fileRef.current.value = "";
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      try {
        const file = await compressImage(rawFile);
        const ext = file.name.match(/\.[^.]+$/)?.[0] ?? ".jpg";
        const path = `${sellerId}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
        const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
        if (error) {
          toast.error(`Failed to upload ${rawFile.name}: ${error.message}`);
        } else {
          const { data } = supabase.storage.from("listings").getPublicUrl(path);
          urls.push(data.publicUrl);
        }
      } catch (err) {
        toast.error(`Failed to upload ${rawFile.name}: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atAuctionLimit) return;
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);

    const durationHours = Number(data.get("duration_hours"));
    const startsAtRaw = data.get("starts_at") as string;
    const startsAt = startsAtRaw ? new Date(startsAtRaw).toISOString() : null;
    const startBase = startsAt ? new Date(startsAt).getTime() : Date.now();
    const endsAt = new Date(startBase + durationHours * 60 * 60 * 1000).toISOString();
    const startingBidCents = dollarsToCents(data.get("starting_bid") as string);
    const buyNowRaw = data.get("buy_now_price") as string;
    const buyNowCents = buyNowRaw ? dollarsToCents(buyNowRaw) : null;
    const reserveRaw = data.get("reserve_price") as string;
    const reserveCents = reserveRaw ? dollarsToCents(reserveRaw) : null;
    const categoryRaw = data.get("category") as string;

    const quantity = Number(data.get("quantity"));
    if (quantity < 1) {
      toast.error("Quantity must be at least 1.");
      setSaving(false);
      return;
    }
    if (buyNowCents && buyNowCents <= startingBidCents) {
      toast.error("Buy Now price must be higher than the starting bid.");
      setSaving(false);
      return;
    }
    if (reserveCents && reserveCents < startingBidCents) {
      toast.error("Reserve price must be at least the starting bid.");
      setSaving(false);
      return;
    }
    if (reserveCents && buyNowCents && reserveCents >= buyNowCents) {
      toast.error("Reserve price must be below the Buy Now price.");
      setSaving(false);
      return;
    }
    if (shippingMode === "flat") {
      const flatCents = dollarsToCents(data.get("shipping_cost") as string);
      if (!flatCents || flatCents <= 0) {
        toast.error("Enter a valid flat shipping rate.");
        setSaving(false);
        return;
      }
    }
    if (shippingMode === "weight") {
      const weightOz = Number(data.get("shipping_weight_oz"));
      if (!weightOz || weightOz <= 0) {
        toast.error("Enter a valid shipping weight.");
        setSaving(false);
        return;
      }
    }

    const supabase = createClient();
    const { error } = await supabase.from("auctions").insert({
      seller_id: sellerId,
      plant_name: data.get("plant_name") as string,
      variety: (data.get("variety") as string) || null,
      quantity,
      description: (data.get("description") as string) || null,
      starting_bid_cents: startingBidCents,
      current_bid_cents: startingBidCents,
      buy_now_price_cents: buyNowCents,
      reserve_price_cents: reserveCents,
      category: categoryRaw || null,
      starts_at: startsAt,
      status: startsAt ? "scheduled" : "active",
      ends_at: endsAt,
      images: imageUrls,
      pot_size: potSize || null,
      free_shipping: shippingMode === "free",
      shipping_cost_cents: shippingMode === "flat" ? dollarsToCents(data.get("shipping_cost") as string) : null,
      shipping_weight_oz: shippingMode === "weight" ? Number(data.get("shipping_weight_oz")) : null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      if (prefill && !keepOriginal) {
        await supabase.from("auctions").delete().eq("id", prefill.id);
        toast.success("Auction relisted!");
      } else if (prefill && keepOriginal) {
        toast.success("Auction duplicated!");
      } else {
        toast.success("Auction created!");
      }
      setOpen(false);
      setImageUrls([]);
      setPlantName("");
      setVariety("");
      setPotSize("");
      setShippingMode("");
      setStartingBidVal(0);
      setBuyNowVal(0);
      setReserveVal(0);
      form.reset();
      router.refresh();
    }
  }

  return (
    <>
      <Button variant={prefill ? "outline" : "default"} size={prefill ? "sm" : "default"} className={prefill ? "" : "bg-leaf hover:bg-forest"} onClick={() => setOpen(true)}>
        {triggerLabel ?? "+ New Auction"}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{prefill ? (keepOriginal ? "Duplicate Auction" : "Relist Auction") : "Create an Auction"}</DialogTitle>
        </DialogHeader>

        {atAuctionLimit && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            You&apos;ve reached your <strong>{planLimit}-auction limit</strong> on the Seedling plan.{" "}
            <Link href="/pricing" className="font-semibold underline" onClick={() => setOpen(false)}>
              Upgrade your plan
            </Link>{" "}
            for unlimited auctions.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="plant_name">Plant Type *</Label>
              <Input
                id="plant_name"
                name="plant_name"
                required
                disabled={atAuctionLimit}
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="variety">Variety</Label>
              <Input
                id="variety"
                name="variety"
                disabled={atAuctionLimit}
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={prefill?.quantity ?? 1} required disabled={atAuctionLimit} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="starting_bid">Starting Bid *</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
                <Input id="starting_bid" name="starting_bid" type="number" min={0.01} step={0.01} required disabled={atAuctionLimit} className="pl-6"
                  value={startingBidVal || ""}
                  onChange={(e) => setStartingBidVal(parseFloat(e.target.value) || 0)} />
              </div>
            </div>
          </div>
          <PriceSuggestion plantName={plantName} variety={variety} label="bid" />
          <div className="space-y-1">
            <Label htmlFor="buy_now_price">Buy Now Price <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
              <Input id="buy_now_price" name="buy_now_price" type="number" min={0.01} step={0.01} placeholder="Leave blank to disable" disabled={atAuctionLimit} className={`pl-6 ${buyNowError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                value={buyNowVal || ""}
                onChange={(e) => setBuyNowVal(parseFloat(e.target.value) || 0)} />
            </div>
            {buyNowError && <p className="text-xs text-red-600">Buy Now price must be higher than the starting bid.</p>}
            {!buyNowError && <p className="text-xs text-muted-foreground">Buyers can skip bidding and purchase immediately at this price.</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="reserve_price">Reserve Price <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">$</span>
              <Input id="reserve_price" name="reserve_price" type="number" min={0.01} step={0.01} placeholder="Leave blank for no reserve" disabled={atAuctionLimit} className={`pl-6 ${reserveError ? "border-red-400 focus-visible:ring-red-400" : ""}`}
                value={reserveVal || ""}
                onChange={(e) => setReserveVal(parseFloat(e.target.value) || 0)} />
            </div>
            {reserveError && <p className="text-xs text-red-600">{reserveVal > 0 && buyNowVal > 0 && reserveVal >= buyNowVal ? "Reserve price must be below the Buy Now price." : "Reserve price must be at least the starting bid."}</p>}
            {!reserveError && <p className="text-xs text-muted-foreground">Auction only completes if bidding reaches this amount. Buyers don&apos;t see the reserve — just whether it&apos;s been met.</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="duration_hours">Duration *</Label>
              <select
                id="duration_hours"
                name="duration_hours"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
                disabled={atAuctionLimit}
              >
                <option value="0.167">10 minutes (test only)</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
                <option value="120">5 days</option>
                <option value="168">7 days</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="category">Category <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <select
                id="category"
                name="category"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                disabled={atAuctionLimit}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="">Select a category…</option>
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="starts_at">Schedule Start <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              disabled={atAuctionLimit}
              step={900}
              value={startsAt}
              onChange={handleStartsAtChange}
              min={(() => {
                const n = new Date();
                const ms15 = 15 * 60 * 1000;
                const next = new Date(Math.ceil(n.getTime() / ms15) * ms15);
                return new Date(next.getTime() - next.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              })()}
            />
            <p className="text-xs text-muted-foreground">Leave blank to start immediately. Set a future date/time to queue the auction.</p>
          </div>
          <div className="space-y-1">
            <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <PotSizePicker value={potSize} onChange={setPotSize} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={1000} disabled={atAuctionLimit} defaultValue={prefill?.description ?? ""} />
          </div>
          <div className="space-y-1">
            <Label>
              Photos{photoLimit !== null && (
                <span className="ml-1 font-normal text-muted-foreground text-xs">({imageUrls.length}/{photoLimit})</span>
              )}
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading || atAuctionLimit || atPhotoLimit}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : "Add photos"}
              </Button>
              {atPhotoLimit && (
                <span className="text-xs text-amber-600">Photo limit reached</span>
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
              <div className="grid grid-cols-4 gap-2 mt-2">
                {imageUrls.map((url, i) => (
                  <div key={url} className="relative group aspect-square">
                    <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover rounded-md border border-border" />
                    <button
                      type="button"
                      onClick={() => setImageUrls((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute top-0.5 right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label="Remove photo"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>Shipping <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-3 gap-2">
              {(["free", "flat", "weight"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setShippingMode(mode)}
                  disabled={atAuctionLimit}
                  className={`rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                    shippingMode === mode
                      ? "border-leaf bg-[#EBF0E6] text-forest dark:bg-forest/40 dark:text-[#A8BF9A] dark:border-leaf"
                      : "border-input hover:bg-muted"
                  }`}
                >
                  {mode === "free" ? "Free" : mode === "flat" ? "Flat rate" : "By weight"}
                </button>
              ))}
            </div>
            {shippingMode === "flat" && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">$</span>
                <Input
                  name="shipping_cost"
                  type="number"
                  min={0.01}
                  step={0.01}
                  placeholder="e.g. 6.99"
                  required
                  className="max-w-[140px]"
                  defaultValue={prefill?.shipping_cost_cents ? (prefill.shipping_cost_cents / 100).toFixed(2) : ""}
                />
                <span className="text-xs text-muted-foreground">flat rate charged to buyer</span>
              </div>
            )}
            {shippingMode === "weight" && !calculatedShippingEnabled && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
                <strong>Ship-from address required.</strong> Weight-based rates need a verified address and calculated shipping enabled.{" "}
                <a href="/account#shipping-settings" className="underline font-medium hover:opacity-80" onClick={() => setOpen(false)}>
                  Set it up in Account Settings →
                </a>
              </div>
            )}
            {shippingMode === "weight" && calculatedShippingEnabled && (
              <div className="flex items-center gap-2">
                <Input
                  name="shipping_weight_oz"
                  type="number"
                  min={0.1}
                  step={0.1}
                  placeholder="e.g. 12"
                  required
                  className="max-w-[100px]"
                  defaultValue={prefill?.shipping_weight_oz ?? ""}
                />
                <span className="text-xs text-muted-foreground">oz — rate calculated at checkout</span>
              </div>
            )}
            {shippingMode === "weight" && calculatedShippingEnabled && (
              <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Enter the actual packed weight. Underreporting causes USPS billing adjustments and may result in account suspension.</p>
            )}
          </div>
          {!shippingMode && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Choose a shipping option above to continue.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || atAuctionLimit || !shippingMode || (shippingMode === "weight" && !calculatedShippingEnabled) || buyNowError || reserveError} className="bg-leaf hover:bg-forest">
              {saving ? "Saving…" : prefill ? (keepOriginal ? "Duplicate auction" : "Relist auction") : "Create auction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
    </>
  );
}
