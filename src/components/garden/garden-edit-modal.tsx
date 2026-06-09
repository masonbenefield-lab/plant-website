"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/compress-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Upload, X, Loader2, Trash2, ExternalLink } from "lucide-react";
import type { GardenPlantStatus } from "@/lib/garden-types";

const STATUS_OPTIONS: { value: GardenPlantStatus; label: string }[] = [
  { value: "thriving", label: "Thriving" },
  { value: "growing", label: "Growing" },
  { value: "dormant", label: "Dormant" },
  { value: "struggling", label: "Struggling" },
  { value: "dead", label: "Dead" },
];

const SOURCE_TYPE_OPTIONS = [
  { value: "nursery", label: "Local nursery" },
  { value: "purchase", label: "Online purchase" },
  { value: "trade", label: "Trade / swap" },
  { value: "propagation", label: "Propagation (from cuttings)" },
  { value: "gift", label: "Gift" },
];

const MAX_PHOTOS = 10;

export function GardenEditModal({
  plantId,
  plantName,
  plantVariety,
}: {
  plantId: string;
  plantName: string;
  plantVariety: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(plantName);
  const [variety, setVariety] = useState(plantVariety ?? "");
  const [status, setStatus] = useState<GardenPlantStatus>("growing");
  const [location, setLocation] = useState("");
  const [plantedAt, setPlantedAt] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [notes, setNotes] = useState("");
  const [publicNotes, setPublicNotes] = useState("");
  const [images, setImages] = useState<string[]>([]);

  // Fetch full plant data when modal opens
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("garden_plants")
      .select("name, variety, status, location, planted_at, source_name, source_type, notes, public_notes, images")
      .eq("id", plantId)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name);
          setVariety(data.variety ?? "");
          setStatus((data.status as GardenPlantStatus) ?? "growing");
          setLocation(data.location ?? "");
          setPlantedAt(data.planted_at?.slice(0, 10) ?? "");
          setSourceType(data.source_type ?? "");
          setSourceName(data.source_name ?? "");
          setNotes(data.notes ?? "");
          setPublicNotes(data.public_notes ?? "");
          setImages(data.images ?? []);
        }
        setLoading(false);
      });
  }, [open, plantId]);

  async function handlePhotoUpload(files: FileList) {
    if (images.length >= MAX_PHOTOS) { toast.error("Maximum 10 photos"); return; }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - images.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      const file = await compressImage(rawFile);
      const path = `garden/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from("garden").upload(path, file);
      if (error) { toast.error("Upload failed"); continue; }
      const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { toast.error("Plant name is required"); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { error } = await supabase
        .from("garden_plants")
        .update({
          name: name.trim(),
          variety: variety.trim() || null,
          status,
          location: location.trim() || null,
          planted_at: plantedAt || null,
          source_type: (sourceType || null) as "nursery" | "purchase" | "trade" | "propagation" | "gift" | null,
          source_name: sourceName.trim() || null,
          notes: notes.trim() || null,
          public_notes: publicNotes.trim() || null,
          images,
        })
        .eq("id", plantId);
      if (error) { toast.error("Failed to save changes"); return; }
      toast.success("Changes saved");
      setOpen(false);
      router.refresh();
    });
  }

  async function handleDelete() {
    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("garden_plants").delete().eq("id", plantId);
    if (error) { toast.error("Failed to delete plant"); setIsDeleting(false); return; }
    toast.success(`${name} removed from your garden`);
    setOpen(false);
    setDeleteConfirm(false);
    router.refresh();
  }

  function handleOpenChange(v: boolean) {
    setOpen(v);
    if (!v) setDeleteConfirm(false);
  }

  const displayName = plantVariety ?? plantName;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors w-fit"
          />
        }
      >
        <Pencil size={11} />
        Edit
      </DialogTrigger>

      <DialogContent
        showCloseButton={false}
        className="sm:max-w-xl p-0 max-h-[90vh] flex flex-col overflow-hidden"
      >
        <form onSubmit={handleSave} className="flex flex-col h-full min-h-0">
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b shrink-0">
            <DialogTitle className="text-base font-semibold truncate pr-4">
              Edit {displayName}
            </DialogTitle>
            <div className="flex items-center gap-3 shrink-0">
              <Link
                href={`/garden/${plantId}/edit`}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Advanced edit page"
                onClick={() => setOpen(false)}
              >
                <ExternalLink size={12} />
                Advanced
              </Link>
              <DialogClose
                render={
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                  />
                }
              >
                <X size={16} />
              </DialogClose>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Photos */}
                <div className="space-y-2">
                  <Label>Photos ({images.length}/{MAX_PHOTOS})</Label>
                  <div className="flex flex-wrap gap-2">
                    {images.map((url) => (
                      <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border group shrink-0">
                        <Image src={url} alt="Plant photo" fill className="object-cover" />
                        <button
                          type="button"
                          onClick={() => setImages((p) => p.filter((u) => u !== url))}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ))}
                    {images.length < MAX_PHOTOS && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="w-20 h-20 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-sage hover:text-leaf transition-colors text-xs shrink-0"
                      >
                        {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                        {!uploading && <span>Add</span>}
                      </button>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => { if (e.target.files) handlePhotoUpload(e.target.files); e.target.value = ""; }}
                  />
                </div>

                {/* Name + Variety */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Plant name *</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monstera" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Variety / cultivar</Label>
                    <Input value={variety} onChange={(e) => setVariety(e.target.value)} placeholder="e.g. Deliciosa" />
                  </div>
                </div>

                {/* Status + Location */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as GardenPlantStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Location</Label>
                    <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Back porch, Raised bed 1…" />
                  </div>
                </div>

                {/* Planted date */}
                <div className="space-y-1.5">
                  <Label>Date planted / acquired</Label>
                  <Input
                    type="date"
                    value={plantedAt}
                    onChange={(e) => setPlantedAt(e.target.value)}
                    className="w-44"
                  />
                </div>

                {/* Source */}
                <div className="space-y-1.5">
                  <Label>Source</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <Select value={sourceType} onValueChange={(v) => setSourceType(v ?? "")}>
                      <SelectTrigger><SelectValue placeholder="Type (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Not specified</SelectItem>
                        {SOURCE_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={sourceName}
                      onChange={(e) => setSourceName(e.target.value)}
                      placeholder="Nursery or seller name"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label>Private notes</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Only visible to you.</p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Care tips, observations, potting mix…"
                    rows={2}
                    className="resize-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Public notes</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Visible to anyone who can see your garden.</p>
                  <Textarea
                    value={publicNotes}
                    onChange={(e) => setPublicNotes(e.target.value)}
                    placeholder="Share care tips, origin story, fun facts…"
                    rows={2}
                    className="resize-none"
                  />
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t bg-muted/30 shrink-0 space-y-3">
            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={isPending || uploading || loading}
                className="bg-leaf hover:bg-forest"
              >
                {isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                Save changes
              </Button>
              <DialogClose
                render={<Button type="button" variant="outline" disabled={isPending} />}
              >
                Cancel
              </DialogClose>
            </div>

            {!deleteConfirm ? (
              <button
                type="button"
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 size={11} />
                Delete plant
              </button>
            ) : (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Permanently delete {name}?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="font-semibold text-red-600 hover:text-red-700 transition-colors"
                >
                  {isDeleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(false)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
