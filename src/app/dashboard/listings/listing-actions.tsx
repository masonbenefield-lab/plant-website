"use client";

import { useRef, useState } from "react";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { dollarsToCents, centsToDisplay } from "@/lib/stripe";
import type { Database } from "@/lib/supabase/types";

type Listing = Database["public"]["Tables"]["listings"]["Row"];

export default function ListingActions({ listing }: { listing: Listing }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Edit form state — pre-filled from listing
  const [plantName, setPlantName] = useState(listing.plant_name);
  const [variety, setVariety] = useState(listing.variety ?? "");
  const [quantity, setQuantity] = useState(String(listing.quantity));
  const [price, setPrice] = useState(String(listing.price_cents / 100));
  const [description, setDescription] = useState(listing.description ?? "");

  function openEdit() {
    // Reset to current values each time dialog opens
    setPlantName(listing.plant_name);
    setVariety(listing.variety ?? "");
    setQuantity(String(listing.quantity));
    setPrice(String(listing.price_cents / 100));
    setDescription(listing.description ?? "");
    setEditOpen(true);
  }

  async function saveEdit() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("listings")
      .update({
        plant_name: plantName.trim(),
        variety: variety.trim() || null,
        quantity: Number(quantity),
        price_cents: dollarsToCents(price),
        description: description.trim() || null,
      })
      .eq("id", listing.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing updated");
    setEditOpen(false);
    router.refresh();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const newUrls: string[] = [];
    for (const file of Array.from(files)) {
      const path = `${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (error) {
        toast.error(`Upload failed: ${error.message}`);
        setUploading(false);
        e.target.value = "";
        return;
      }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }

    const updatedImages = [...(listing.images ?? []), ...newUrls];
    const { error: updateError } = await supabase
      .from("listings")
      .update({ images: updatedImages })
      .eq("id", listing.id);

    setUploading(false);
    e.target.value = "";
    if (updateError) { toast.error(updateError.message); return; }
    toast.success(`${newUrls.length} photo${newUrls.length !== 1 ? "s" : ""} added`);
    router.refresh();
  }

  async function toggleStatus() {
    const supabase = createClient();
    const newStatus = listing.status === "active" ? "paused" : "active";
    const { error } = await supabase.from("listings").update({ status: newStatus }).eq("id", listing.id);
    if (error) toast.error(error.message);
    else { toast.success(`Listing ${newStatus}`); router.refresh(); }
  }

  async function deleteListing() {
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("listings").delete().eq("id", listing.id);
    setDeleting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    setDeleteOpen(false);
    router.refresh();
  }

  return (
    <>
      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />

      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="sm" disabled={uploading} />}>
          {uploading ? "Uploading…" : "Actions"}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={openEdit}>Edit</DropdownMenuItem>
          <DropdownMenuItem onClick={() => fileRef.current?.click()}>Add Photo</DropdownMenuItem>
          <DropdownMenuItem onClick={toggleStatus}>
            {listing.status === "active" ? "Pause" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDeleteOpen(true)} className="text-red-600">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete listing?</DialogTitle>
            <DialogDescription>
              This will permanently remove <strong>{listing.plant_name}</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} className="flex-1">Cancel</Button>
            <Button variant="destructive" onClick={deleteListing} disabled={deleting} className="flex-1">
              {deleting ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-plant-name">Plant Name *</Label>
                <Input id="edit-plant-name" value={plantName} onChange={(e) => setPlantName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-variety">Variety</Label>
                <Input id="edit-variety" value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="Optional" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="edit-quantity">Quantity</Label>
                <Input id="edit-quantity" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="edit-price">Price ($)</Label>
                <Input id="edit-price" type="number" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label htmlFor="edit-description">Description</Label>
                <span className="text-xs text-muted-foreground">{description.length}/1000</span>
              </div>
              <Textarea id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button
                onClick={saveEdit}
                disabled={saving || !plantName.trim()}
                className="bg-green-700 hover:bg-green-800"
              >
                {saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
