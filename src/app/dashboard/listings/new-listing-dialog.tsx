"use client";

import { useState, useRef } from "react";
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
    for (const file of toUpload) {
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
    setSaving(true);
    const form = e.currentTarget;
    const data = new FormData(form);

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
      form.reset();
      router.refresh();
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="bg-green-700 hover:bg-green-800" />}>
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
              {imageUrls.length > 0 && photoLimit === null && (
                <span className="text-sm text-muted-foreground">{imageUrls.length} uploaded</span>
              )}
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
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || atListingLimit} className="bg-green-700 hover:bg-green-800">
              {saving ? "Saving…" : "Create listing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
