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
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { dollarsToCents } from "@/lib/stripe";
import PriceSuggestion from "@/components/price-suggestion";
import PotSizePicker from "@/components/pot-size-picker";

interface Props {
  sellerId: string;
  planLimit: number | null;
  currentCount: number;
  photoLimit: number | null;
}

export default function NewListingDialog({ sellerId, planLimit, currentCount, photoLimit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [potSize, setPotSize] = useState("");
  const [shippingMode, setShippingMode] = useState<"" | "free" | "flat" | "weight">("");
  const [packageType, setPackageType] = useState("box");
  const fileRef = useRef<HTMLInputElement>(null);

  const atListingLimit = planLimit !== null && currentCount >= planLimit;
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
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      const file = await compressImage(rawFile);
      const path = `${sellerId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("listings").getPublicUrl(path);
        urls.push(data.publicUrl);
      }
    }
    setImageUrls((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (atListingLimit) return;
    const form = e.currentTarget;
    const data = new FormData(form);
    if (shippingMode === "weight" && packageType === "box") {
      const l = Number(data.get("box_length_in"));
      const w = Number(data.get("box_width_in"));
      const h = Number(data.get("box_height_in"));
      if (l > 48 || w > 24 || h > 24) {
        toast.error("Box dimensions exceed carrier limits (max 48 × 24 × 24 in).");
        return;
      }
    }
    setSaving(true);

    const supabase = createClient();
    const { error } = await supabase.from("listings").insert({
      seller_id: sellerId,
      plant_name: data.get("plant_name") as string,
      variety: (data.get("variety") as string) || null,
      quantity: Number(data.get("quantity")),
      price_cents: dollarsToCents(data.get("price") as string),
      description: (data.get("description") as string) || null,
      images: imageUrls,
      pot_size: potSize || null,
      free_shipping: shippingMode === "free",
      shipping_cost_cents: shippingMode === "flat" ? dollarsToCents(data.get("shipping_cost") as string) : null,
      shipping_weight_oz: shippingMode === "weight" ? Number(data.get("shipping_weight_oz")) : null,
      box_length_in: shippingMode === "weight" && packageType === "box" ? (Number(data.get("box_length_in")) || 10) : null,
      box_width_in: shippingMode === "weight" && packageType === "box" ? (Number(data.get("box_width_in")) || 8) : null,
      box_height_in: shippingMode === "weight" && packageType === "box" ? (Number(data.get("box_height_in")) || 4) : null,
      package_type: shippingMode === "weight" ? packageType : null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Listing created!");
      setOpen(false);
      setImageUrls([]);
      setPlantName("");
      setVariety("");
      setPotSize("");
      setShippingMode("");
      form.reset();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-leaf hover:bg-forest" />}>
        + New Listing
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create a Listing</DialogTitle>
        </DialogHeader>

        {atListingLimit && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            You&apos;ve reached your <strong>{planLimit}-listing limit</strong>.{" "}
            <Link href="/pricing" className="font-semibold underline" onClick={() => setOpen(false)}>
              Upgrade your plan
            </Link>{" "}
            to add more.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="plant_name">Plant Name *</Label>
              <Input
                id="plant_name"
                name="plant_name"
                required
                disabled={atListingLimit}
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="variety">Variety</Label>
              <Input
                id="variety"
                name="variety"
                disabled={atListingLimit}
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required disabled={atListingLimit} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price">Price ($) *</Label>
              <Input id="price" name="price" type="number" min={0.01} step={0.01} required disabled={atListingLimit} />
              <PriceSuggestion plantName={plantName} variety={variety} label="price" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <PotSizePicker value={potSize} onChange={setPotSize} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={1000} disabled={atListingLimit} />
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
                disabled={uploading || atListingLimit || atPhotoLimit}
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
                  disabled={atListingLimit}
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
                />
                <span className="text-xs text-muted-foreground">flat rate charged to buyer</span>
              </div>
            )}
            {shippingMode === "weight" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    name="shipping_weight_oz"
                    type="number"
                    min={0.1}
                    step={0.1}
                    placeholder="e.g. 12"
                    required
                    className="max-w-[100px]"
                  />
                  <span className="text-xs text-muted-foreground">oz packed weight</span>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Package type</p>
                  <select
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="h-8 w-full rounded-lg border border-input bg-white px-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-ring/50 dark:bg-gray-800 dark:text-gray-100"
                  >
                    <option value="box">Box (custom dimensions)</option>
                    <option value="padded_envelope">Padded envelope (12.5 × 9.5 × 1 in)</option>
                    <option value="poly_mailer">Poly mailer (12 × 15 × 0.25 in)</option>
                  </select>
                </div>
                {packageType === "box" && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Box dimensions (inches)</p>
                    <div className="flex items-center gap-2">
                      <Input name="box_length_in" type="number" min={1} max={48} step={0.5} placeholder="L" className="w-16 text-xs" defaultValue={10} />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input name="box_width_in" type="number" min={1} max={24} step={0.5} placeholder="W" className="w-16 text-xs" defaultValue={8} />
                      <span className="text-xs text-muted-foreground">×</span>
                      <Input name="box_height_in" type="number" min={1} max={24} step={0.5} placeholder="H" className="w-16 text-xs" defaultValue={4} />
                      <span className="text-xs text-muted-foreground">in</span>
                    </div>
                  </div>
                )}
                <p className="text-xs text-amber-600 dark:text-amber-400">⚠️ Enter the actual packed weight. Max box size: 48 × 24 × 24 in. Underreporting causes USPS billing adjustments.</p>
              </div>
            )}
          </div>
          {!shippingMode && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Choose a shipping option above to continue.</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || atListingLimit || !shippingMode} className="bg-leaf hover:bg-forest">
              {saving ? "Saving…" : "Create listing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
