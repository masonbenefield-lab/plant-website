"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PLANT_CATEGORIES } from "@/lib/categories";
import { AlertTriangle } from "lucide-react";
import PotSizePicker from "@/components/pot-size-picker";
import { getPlanLimits, type PlanLimits } from "@/lib/plan-limits";

export default function CreateInventoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [profileWarning, setProfileWarning] = useState<"incomplete" | "unverified" | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({ listings: null, auctions: null, photos: null });

  useEffect(() => {
    async function checkProfile() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      if (!user.email_confirmed_at) { setProfileWarning("unverified"); return; }
      const [{ data: profile }, { data: planProfile }] = await Promise.all([
        supabase.from("profiles").select("bio, avatar_url").eq("id", user.id).single(),
        supabase.from("profiles").select("plan, is_admin").eq("id", user.id).single(),
      ]);
      if (!profile?.bio?.trim() || !profile?.avatar_url) {
        setProfileWarning("incomplete");
      }
      setPlanLimits(getPlanLimits(planProfile?.plan, !!planProfile?.is_admin));
    }
    checkProfile();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length) uploadImages(files);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [potSize, setPotSize] = useState("");

  async function uploadImages(files: FileList) {
    const photoLimit = planLimits.photos;
    if (photoLimit !== null && imageUrls.length >= photoLimit) {
      toast.error(`Your plan allows ${photoLimit} photos per listing.`);
      return;
    }
    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const remaining = photoLimit !== null ? photoLimit - imageUrls.length : Infinity;
    const toUpload = Array.from(files).slice(0, remaining);
    const urls: string[] = [];
    for (const file of toUpload) {
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
    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSaving(false); return; }

    const { error } = await supabase.from("inventory").insert({
      seller_id: user.id,
      plant_name: plantName,
      variety: variety || null,
      quantity: Number(quantity),
      description: description || null,
      images: imageUrls,
      category: category || null,
      pot_size: potSize || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved to inventory!");
    router.push("/dashboard/inventory");
  }

  const canSubmit = plantName.trim() && Number(quantity) >= 1;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Add to Inventory</h1>
        <p className="text-muted-foreground mt-1">Add a plant to your inventory. You can list it in the shop or create an auction from your Inventory page.</p>
      </div>

      {profileWarning === "unverified" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 mb-6 text-sm">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-400">Verify your email to start selling</p>
            <p className="text-amber-700 dark:text-amber-500 mt-0.5">Check your inbox for a confirmation link. You can still save items to inventory.</p>
          </div>
        </div>
      )}
      {profileWarning === "incomplete" && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800 px-4 py-3 mb-6 text-sm">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-400">Complete your profile before listing publicly</p>
            <p className="text-amber-700 dark:text-amber-500 mt-0.5">
              Buyers trust sellers with a profile photo and bio.{" "}
              <Link href="/account" className="underline font-medium">Set up your profile →</Link>
            </p>
          </div>
        </div>
      )}

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
              <Label htmlFor="quantity">Quantity *</Label>
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
              <Label>Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <PotSizePicker value={potSize} onChange={setPotSize} />
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

            <div className="space-y-1">
              <Label htmlFor="category">Category</Label>
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select a category…</option>
                {PLANT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>
                Photos{planLimits.photos !== null && (
                  <span className="ml-1 font-normal text-muted-foreground text-xs">({imageUrls.length}/{planLimits.photos})</span>
                )}
              </Label>
              <div
                onClick={() => { if (!uploading && !(planLimits.photos !== null && imageUrls.length >= planLimits.photos)) fileRef.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  planLimits.photos !== null && imageUrls.length >= planLimits.photos
                    ? "border-muted-foreground/20 opacity-50 cursor-not-allowed"
                    : dragging
                    ? "border-green-500 bg-green-50 cursor-pointer"
                    : "border-muted-foreground/25 hover:border-green-400 hover:bg-muted/40 cursor-pointer"
                } ${uploading ? "pointer-events-none opacity-60" : ""}`}
              >
                {uploading ? (
                  <>
                    <span className="text-2xl">⏳</span>
                    <p className="text-sm text-muted-foreground">Uploading…</p>
                  </>
                ) : planLimits.photos !== null && imageUrls.length >= planLimits.photos ? (
                  <>
                    <span className="text-3xl">📷</span>
                    <p className="text-sm font-medium">Photo limit reached</p>
                    <p className="text-xs text-muted-foreground">
                      <Link href="/pricing" className="underline">Upgrade</Link> for more photos
                    </p>
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

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || !canSubmit} className="bg-green-700 hover:bg-green-800">
            {saving ? "Saving…" : "Save to Inventory"}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground">Fill in plant name and quantity to save.</p>
          )}
        </div>
      </form>
    </div>
  );
}
