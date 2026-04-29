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
import PriceSuggestion from "@/components/price-suggestion";
import PotSizePicker from "@/components/pot-size-picker";

export default function NewAuctionDialog({ sellerId }: { sellerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [potSize, setPotSize] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function uploadImages(files: FileList) {
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${sellerId}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage
        .from("auctions")
        .upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("auctions").getPublicUrl(path);
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

    const durationHours = Number(data.get("duration_hours"));
    const endsAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
    const startingBidCents = dollarsToCents(data.get("starting_bid") as string);
    const buyNowRaw = data.get("buy_now_price") as string;
    const buyNowCents = buyNowRaw ? dollarsToCents(buyNowRaw) : null;

    const supabase = createClient();
    const { error } = await supabase.from("auctions").insert({
      seller_id: sellerId,
      plant_name: data.get("plant_name") as string,
      variety: (data.get("variety") as string) || null,
      quantity: Number(data.get("quantity")),
      description: (data.get("description") as string) || null,
      starting_bid_cents: startingBidCents,
      current_bid_cents: startingBidCents,
      buy_now_price_cents: buyNowCents,
      ends_at: endsAt,
      images: imageUrls,
      pot_size: potSize || null,
    });

    setSaving(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Auction created!");
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
        + New Auction
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create an Auction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="plant_name">Plant Name *</Label>
              <Input
                id="plant_name"
                name="plant_name"
                required
                value={plantName}
                onChange={(e) => setPlantName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="variety">Variety</Label>
              <Input
                id="variety"
                name="variety"
                value={variety}
                onChange={(e) => setVariety(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="starting_bid">Starting Bid ($) *</Label>
              <Input id="starting_bid" name="starting_bid" type="number" min={0.01} step={0.01} required />
              <PriceSuggestion plantName={plantName} variety={variety} label="bid" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="buy_now_price">Buy Now Price ($) <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input id="buy_now_price" name="buy_now_price" type="number" min={0.01} step={0.01} placeholder="Leave blank to disable" />
            <p className="text-xs text-muted-foreground">Buyers can skip bidding and purchase immediately at this price.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="duration_hours">Duration *</Label>
            <select
              id="duration_hours"
              name="duration_hours"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              required
            >
              <option value="24">24 hours</option>
              <option value="48">48 hours</option>
              <option value="72">72 hours</option>
              <option value="120">5 days</option>
              <option value="168">7 days</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <PotSizePicker value={potSize} onChange={setPotSize} />
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
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-800">
              {saving ? "Saving…" : "Create auction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
