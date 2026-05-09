"use client";

import { useState, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
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
import { toast } from "sonner";
import { X, Upload, Loader2 } from "lucide-react";
import type { GardenPlantStatus } from "@/lib/supabase/types";

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

interface GardenFormProps {
  mode: "add" | "edit";
  plant?: {
    id: string;
    name: string;
    variety: string | null;
    status: GardenPlantStatus;
    location: string | null;
    planted_at: string | null;
    source_name: string | null;
    source_type: string | null;
    notes: string | null;
    images: string[];
    water_interval_days: number | null;
    fertilize_interval_days: number | null;
    repot_interval_days: number | null;
    prune_interval_days: number | null;
  };
}

const MAX_PHOTOS = 10;

export function GardenForm({ mode, plant }: GardenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(plant?.name ?? "");
  const [variety, setVariety] = useState(plant?.variety ?? "");
  const [status, setStatus] = useState<GardenPlantStatus>(plant?.status ?? "growing");
  const [location, setLocation] = useState(plant?.location ?? "");
  const [plantedAt, setPlantedAt] = useState(plant?.planted_at?.slice(0, 10) ?? "");
  const [sourceName, setSourceName] = useState(plant?.source_name ?? "");
  const [sourceType, setSourceType] = useState<string>(plant?.source_type ?? "");
  const [notes, setNotes] = useState(plant?.notes ?? "");
  const [images, setImages] = useState<string[]>(plant?.images ?? []);
  const [waterInterval, setWaterInterval] = useState(plant?.water_interval_days?.toString() ?? "");
  const [fertilizeInterval, setFertilizeInterval] = useState(plant?.fertilize_interval_days?.toString() ?? "");
  const [repotInterval, setRepotInterval] = useState(plant?.repot_interval_days?.toString() ?? "");
  const [pruneInterval, setPruneInterval] = useState(plant?.prune_interval_days?.toString() ?? "");
  const [uploading, setUploading] = useState(false);

  async function handlePhotoUpload(files: FileList) {
    if (images.length >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - images.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 8 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 8 MB)`);
        continue;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `garden/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("garden").upload(path, file);
      if (error) {
        toast.error(`Failed to upload ${file.name}`);
        continue;
      }
      const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  function removePhoto(url: string) {
    setImages((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Plant name is required");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const payload = {
        name: name.trim(),
        variety: variety.trim() || null,
        status,
        location: location.trim() || null,
        planted_at: plantedAt || null,
        source_name: sourceName.trim() || null,
        source_type: (sourceType || null) as "nursery" | "purchase" | "trade" | "propagation" | "gift" | null,
        notes: notes.trim() || null,
        images,
        water_interval_days: waterInterval ? parseInt(waterInterval) : null,
        fertilize_interval_days: fertilizeInterval ? parseInt(fertilizeInterval) : null,
        repot_interval_days: repotInterval ? parseInt(repotInterval) : null,
        prune_interval_days: pruneInterval ? parseInt(pruneInterval) : null,
      };

      if (mode === "add") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Not signed in"); return; }
        const { data, error } = await supabase
          .from("garden_plants")
          .insert({ ...payload, user_id: user.id })
          .select("id")
          .single();
        if (error) { toast.error("Failed to add plant"); return; }
        toast.success(`${name} added to your garden`);
        router.push(`/garden/${data.id}`);
        router.refresh();
      } else {
        const { error } = await supabase
          .from("garden_plants")
          .update(payload)
          .eq("id", plant!.id);
        if (error) { toast.error("Failed to save changes"); return; }
        toast.success("Changes saved");
        router.push(`/garden/${plant!.id}`);
        router.refresh();
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* Photos */}
      <div className="space-y-2">
        <Label>Photos ({images.length}/{MAX_PHOTOS})</Label>
        <div className="flex flex-wrap gap-3">
          {images.map((url) => (
            <div key={url} className="relative w-24 h-24 rounded-lg overflow-hidden border group">
              <Image src={url} alt="Plant photo" fill className="object-cover" />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={11} className="text-white" />
              </button>
            </div>
          ))}
          {images.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors text-xs"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
              {!uploading && <span>Add photo</span>}
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handlePhotoUpload(e.target.files)}
        />
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP · max 8 MB each</p>
      </div>

      {/* Name + Variety */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Plant name *</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Monstera, Lemon tree"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="variety">Variety / cultivar</Label>
          <Input
            id="variety"
            value={variety}
            onChange={(e) => setVariety(e.target.value)}
            placeholder="e.g. Deliciosa, Meyer"
          />
        </div>
      </div>

      {/* Status + Location */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as GardenPlantStatus)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Back porch, Living room, Raised bed 1"
          />
        </div>
      </div>

      {/* Planted date */}
      <div className="space-y-1.5">
        <Label htmlFor="planted_at">Date planted / acquired</Label>
        <Input
          id="planted_at"
          type="date"
          value={plantedAt}
          onChange={(e) => setPlantedAt(e.target.value)}
          className="w-48"
        />
      </div>

      {/* Source */}
      <div className="space-y-2">
        <Label>Where did it come from?</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select value={sourceType} onValueChange={(v) => setSourceType(v ?? "")}>
            <SelectTrigger>
              <SelectValue placeholder="Select source type" />
            </SelectTrigger>
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
            placeholder="Name / seller / friend"
          />
        </div>
      </div>

      {/* Care schedule */}
      <div className="space-y-2">
        <Label>Care reminders <span className="text-muted-foreground font-normal text-xs">(optional — shows in your feed and monthly email)</span></Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <IntervalInput label="💧 Water every" value={waterInterval} onChange={setWaterInterval} />
          <IntervalInput label="🌿 Fertilize every" value={fertilizeInterval} onChange={setFertilizeInterval} />
          <IntervalInput label="🪴 Repot every" value={repotInterval} onChange={setRepotInterval} />
          <IntervalInput label="✂️ Prune every" value={pruneInterval} onChange={setPruneInterval} />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Care tips, observations, potting mix, soil type..."
          rows={4}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || uploading}
          className="bg-green-700 hover:bg-green-800"
        >
          {isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
          {mode === "add" ? "Add to garden" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

function IntervalInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={1}
          max={365}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="—"
          className="w-16 text-center"
        />
        <span className="text-xs text-muted-foreground">days</span>
      </div>
    </div>
  );
}
