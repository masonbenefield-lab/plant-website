"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
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

export default function NewListingDialog({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImages(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${sellerId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("listings")
        .upload(path, file, { upsert: true });
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
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Listing created!");
      setOpen(false);
      setImageUrls([]);
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
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="plant_name">Plant Name *</Label>
              <Input id="plant_name" name="plant_name" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="variety">Variety</Label>
              <Input id="variety" name="variety" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="price">Price ($) *</Label>
              <Input id="price" name="price" type="number" min={0.01} step={0.01} required />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" name="description" rows={3} maxLength={1000} />
          </div>
          <div className="space-y-1">
            <Label>Photos</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? "Uploading…" : "Add photos"}
              </Button>
              {imageUrls.length > 0 && (
                <span className="text-sm text-muted-foreground">{imageUrls.length} uploaded</span>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) uploadImages(e.target.files);
              }}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800">
              {saving ? "Saving…" : "Create listing"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
