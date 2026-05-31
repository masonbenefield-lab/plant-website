"use client";

import { useState, useRef, useTransition, useEffect } from "react";
import { compressImage } from "@/lib/compress-image";
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
import { X, Upload, Loader2, CheckCircle2 } from "lucide-react";
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

type PlantetUser = { id: string; username: string; display_name: string | null; avatar_url: string | null };

interface GardenFormProps {
  mode: "add" | "edit";
  returnTo?: string;
  plant?: {
    id: string;
    name: string;
    variety: string | null;
    status: GardenPlantStatus;
    location: string | null;
    planted_at: string | null;
    source_name: string | null;
    source_type: string | null;
    source_listing_id: string | null;
    notes: string | null;
    public_notes: string | null;
    images: string[];
    water_interval_days: number | null;
    fertilize_interval_days: number | null;
    repot_interval_days: number | null;
    prune_interval_days: number | null;
    from_user_id: string | null;
    origin_verified: boolean;
  };
  initialValues?: {
    name?: string;
    variety?: string;
    sourceType?: string;
    sourceName?: string;
    sourceListingId?: string;
  };
}

const MAX_PHOTOS = 10;

export function GardenForm({ mode, plant, initialValues, returnTo }: GardenFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(plant?.name ?? initialValues?.name ?? "");
  const [variety, setVariety] = useState(plant?.variety ?? initialValues?.variety ?? "");
  const [status, setStatus] = useState<GardenPlantStatus>(plant?.status ?? "growing");
  const [location, setLocation] = useState(plant?.location ?? "");
  const [plantedAt, setPlantedAt] = useState(plant?.planted_at?.slice(0, 10) ?? "");
  const [sourceName, setSourceName] = useState(plant?.source_name ?? initialValues?.sourceName ?? "");
  const [sourceType, setSourceType] = useState<string>(plant?.source_type ?? initialValues?.sourceType ?? "");
  const [notes, setNotes] = useState(plant?.notes ?? "");
  const [publicNotes, setPublicNotes] = useState(plant?.public_notes ?? "");
  const [images, setImages] = useState<string[]>(plant?.images ?? []);
  const [uploading, setUploading] = useState(false);
  const [shareToFeed, setShareToFeed] = useState(false);

  // Plantet member section
  const [selectedPlantetUser, setSelectedPlantetUser] = useState<PlantetUser | null>(null);
  const [plantetQuery, setPlantetQuery] = useState("");
  const [plantetUserChanged, setPlantetUserChanged] = useState(false);
  const [plantetChecking, setPlantetChecking] = useState(false);
  const [plantetSuggestions, setPlantetSuggestions] = useState<PlantetUser[]>([]);
  const plantetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const plantetRef = useRef<HTMLDivElement>(null);

  async function handlePhotoUpload(files: FileList) {
    if (images.length >= MAX_PHOTOS) {
      toast.error(`Maximum ${MAX_PHOTOS} photos allowed`);
      return;
    }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - images.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      const file = await compressImage(rawFile);
      const path = `garden/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
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

  // Close Plantet dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (plantetRef.current && !plantetRef.current.contains(e.target as Node)) {
        setPlantetSuggestions([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load linked user profile in edit mode
  useEffect(() => {
    if (mode !== "edit" || !plant?.from_user_id) return;
    const supabase = createClient();
    supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", plant.from_user_id)
      .single()
      .then(({ data }) => {
        if (data) setSelectedPlantetUser(data as PlantetUser);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-resend pending origin request for existing unverified plants
  useEffect(() => {
    if (mode === "edit" && plant?.from_user_id && !plant?.origin_verified) {
      fetch("/api/garden/origin-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plant_id: plant.id, verifier_user_id: plant.from_user_id }),
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handlePlantetQueryChange(val: string) {
    setPlantetQuery(val);
    setPlantetSuggestions([]);
    if (plantetTimerRef.current) clearTimeout(plantetTimerRef.current);
    if (!val.trim() || val.trim().length < 2) { setPlantetChecking(false); return; }
    setPlantetChecking(true);
    plantetTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(val.trim())}`);
        const data = await res.json();
        setPlantetSuggestions((data.users ?? []).slice(0, 5));
      } finally {
        setPlantetChecking(false);
      }
    }, 400);
  }

  function selectPlantetUser(u: PlantetUser) {
    setSelectedPlantetUser(u);
    setPlantetUserChanged(true);
    setPlantetQuery("");
    setPlantetSuggestions([]);
    if (plantetTimerRef.current) clearTimeout(plantetTimerRef.current);
    setPlantetChecking(false);
    if (!sourceName.trim()) setSourceName(u.display_name || u.username);
  }

  function clearPlantetUser() {
    setSelectedPlantetUser(null);
    setPlantetUserChanged(true);
    setPlantetQuery("");
    setPlantetSuggestions([]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Plant name is required");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();

      const fromUserIdPayload = plantetUserChanged
        ? { from_user_id: selectedPlantetUser?.id ?? null, ...(selectedPlantetUser ? { origin_verified: false } : {}) }
        : {};

      const payload = {
        name: name.trim(),
        variety: variety.trim() || null,
        status,
        location: location.trim() || null,
        planted_at: plantedAt || null,
        source_name: sourceName.trim() || null,
        source_type: (sourceType || null) as "nursery" | "purchase" | "trade" | "propagation" | "gift" | null,
        source_listing_id: plant?.source_listing_id ?? initialValues?.sourceListingId ?? null,
        shared_at: mode === "add" && shareToFeed ? new Date().toISOString() : (plant ? undefined : null),
        notes: notes.trim() || null,
        public_notes: publicNotes.trim() || null,
        images,
        ...fromUserIdPayload,
      };

      if (mode === "add") {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { toast.error("Not signed in"); return; }

        // Check if this is their first plant before inserting
        const { count: existingCount } = await supabase
          .from("garden_plants")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id);
        const isFirstPlant = (existingCount ?? 0) === 0;

        const { data, error } = await supabase
          .from("garden_plants")
          .insert({ ...payload, user_id: user.id })
          .select("id")
          .single();
        if (error) { toast.error("Failed to add plant"); return; }

        // Fire referral activation if this is their first plant
        if (isFirstPlant) {
          fetch("/api/garden/activate-referral", { method: "POST" }).catch(() => {});
        }

        if (selectedPlantetUser) {
          fetch("/api/garden/origin-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plant_id: data.id, verifier_user_id: selectedPlantetUser.id }),
          }).catch(() => {});
        }

        toast.success(`${name} added to your garden`);
        router.push(`/garden/${data.id}`);
        router.refresh();
      } else {
        const { error } = await supabase
          .from("garden_plants")
          .update(payload)
          .eq("id", plant!.id);
        if (error) { toast.error("Failed to save changes"); return; }

        if (plantetUserChanged && selectedPlantetUser) {
          fetch("/api/garden/origin-request", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ plant_id: plant!.id, verifier_user_id: selectedPlantetUser.id }),
          }).catch(() => {});
        }

        toast.success("Changes saved");
        router.push(returnTo ?? `/garden/${plant!.id}`, { scroll: !returnTo });
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
                className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
              >
                <X size={12} className="text-white" />
              </button>
            </div>
          ))}
          {images.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-sage hover:text-leaf transition-colors text-xs"
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
        <p className="text-xs text-muted-foreground">JPG, PNG, WebP · auto-compressed for fast upload</p>
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
            placeholder="Nursery, friend, seller name…"
          />
        </div>
      </div>

      {/* Plantet member */}
      <div className="space-y-2">
        <Label>Got this from a Plantet member?</Label>
        <div className="relative" ref={plantetRef}>
          {selectedPlantetUser ? (
            <div className="flex items-center gap-2.5 p-2.5 rounded-lg border bg-muted/40">
              {selectedPlantetUser.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={selectedPlantetUser.avatar_url} alt={selectedPlantetUser.username} className="h-8 w-8 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-8 w-8 rounded-full bg-[#DFE7D4] flex items-center justify-center text-leaf text-xs font-bold shrink-0">
                  {selectedPlantetUser.username.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight truncate">{selectedPlantetUser.display_name || selectedPlantetUser.username}</p>
                <p className="text-xs text-muted-foreground leading-tight">@{selectedPlantetUser.username}</p>
              </div>
              {!plantetUserChanged && plant?.origin_verified ? (
                <span className="text-xs text-leaf flex items-center gap-1 shrink-0"><CheckCircle2 size={11} /> Verified</span>
              ) : !plantetUserChanged && plant?.from_user_id && !plant?.origin_verified ? (
                <span className="text-xs text-amber-600 shrink-0">Pending confirmation</span>
              ) : (
                <span className="text-xs text-muted-foreground shrink-0">Will be notified</span>
              )}
              <button
                type="button"
                onClick={clearPlantetUser}
                className="shrink-0 p-1 rounded hover:bg-muted transition-colors"
                aria-label="Remove"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <Input
                value={plantetQuery}
                onChange={(e) => handlePlantetQueryChange(e.target.value)}
                placeholder="Search by username or name…"
                autoComplete="off"
              />
              {plantetChecking && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Loader2 size={11} className="animate-spin" /> Searching...
                </p>
              )}
              {plantetSuggestions.length > 0 && (
                <div className="absolute z-50 w-full top-full mt-1 rounded-lg border bg-card shadow-lg overflow-hidden">
                  {plantetSuggestions.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectPlantetUser(u); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/60 transition-colors"
                    >
                      {u.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={u.avatar_url} alt={u.username} className="h-7 w-7 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-7 w-7 rounded-full bg-[#DFE7D4] flex items-center justify-center text-leaf text-xs font-bold shrink-0">
                          {u.username.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight truncate">{u.display_name || u.username}</p>
                        {u.display_name && (
                          <p className="text-xs text-muted-foreground leading-tight">@{u.username}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Select a member and they&apos;ll be asked to confirm — shows as &quot;Verified&quot; once they do.
        </p>
      </div>

      {/* Notes */}
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="notes">Private notes</Label>
          <p className="text-xs text-muted-foreground -mt-1">Only visible to you.</p>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Care tips, observations, potting mix, soil type..."
            rows={3}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="public_notes">Public notes</Label>
          <p className="text-xs text-muted-foreground -mt-1">Visible to anyone who can see your garden.</p>
          <Textarea
            id="public_notes"
            value={publicNotes}
            onChange={(e) => setPublicNotes(e.target.value)}
            placeholder="Share care tips, origin story, fun facts about this plant..."
            rows={3}
          />
        </div>
      </div>

      {mode === "add" && (
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={shareToFeed}
            onChange={(e) => setShareToFeed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-border accent-leaf"
          />
          <div>
            <span className="text-sm font-medium">Share to your followers&apos; feeds</span>
            <p className="text-xs text-muted-foreground mt-0.5">
              Followers will see a card for this plant in their feed. Your garden must be public for the link to work.
            </p>
          </div>
        </label>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isPending || uploading}
          className="bg-leaf hover:bg-forest"
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
