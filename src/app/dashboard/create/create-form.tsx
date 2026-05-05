"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { PLANT_CATEGORIES } from "@/lib/categories";
import { AlertTriangle, Plus, X, Store } from "lucide-react";
import { dollarsToCents } from "@/lib/stripe";
import PotSizePicker from "@/components/pot-size-picker";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { getPlanLimits, type PlanLimits } from "@/lib/plan-limits";

type SizeEntry = { id: number; potSize: string; quantity: string };

let nextId = 1;

export default function CreateInventoryPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [profileWarning, setProfileWarning] = useState<"incomplete" | "unverified" | null>(null);
  const [planLimits, setPlanLimits] = useState<PlanLimits>({ listings: null, auctions: null, photos: null });

  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Other");
  const [existingGroup, setExistingGroup] = useState<{ plant_name: string; count: number } | null>(null);

  // Multiple sizes — each becomes its own inventory row
  const [sizes, setSizes] = useState<SizeEntry[]>([{ id: 0, potSize: "", quantity: "1" }]);

  // Optional: list in shop immediately (only when single size)
  const [listInShop, setListInShop] = useState(false);
  const [shopPrice, setShopPrice] = useState("");
  const [shopQuantity, setShopQuantity] = useState("");

  function addSize() {
    setSizes(prev => [...prev, { id: nextId++, potSize: "", quantity: "1" }]);
  }

  function removeSize(id: number) {
    setSizes(prev => prev.filter(s => s.id !== id));
  }

  function updateSize(id: number, field: keyof Omit<SizeEntry, "id">, value: string) {
    setSizes(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  }

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
      if (!profile?.bio?.trim() || !profile?.avatar_url) setProfileWarning("incomplete");
      setPlanLimits(getPlanLimits(planProfile?.plan, !!planProfile?.is_admin));
    }
    checkProfile();
  }, []);

  useEffect(() => {
    if (!plantName.trim()) { setExistingGroup(null); return; }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("inventory")
        .select("id, plant_name, variety")
        .eq("seller_id", user.id)
        .ilike("plant_name", plantName.trim())
        .is("archived_at", null);
      if (!data || data.length === 0) { setExistingGroup(null); return; }
      const matches = data.filter(item =>
        (item.variety ?? "").toLowerCase() === variety.trim().toLowerCase()
      );
      setExistingGroup(matches.length > 0 ? { plant_name: data[0].plant_name, count: matches.length } : null);
    }, 500);
    return () => clearTimeout(timer);
  }, [plantName, variety]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadImages(e.dataTransfer.files);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (error) { toast.error(`Upload failed: ${error.message}`); setUploading(false); return; }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      urls.push(data.publicUrl);
    }
    setImageUrls(prev => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields: [string, string][] = [
      [plantName, "plant name"],
      [variety, "variety"],
      [description, "description"],
    ];
    for (const [text, label] of fields) {
      if (!text) continue;
      const hit = findProhibitedWord(text);
      if (hit) {
        toast.error(`Your ${label} contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, `inventory-${label}`, text);
        return;
      }
    }

    setSaving(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Not logged in"); setSaving(false); return; }

    const shouldList = listInShop && sizes.length === 1 && shopPrice;
    const listedQty = Math.min(
      Math.max(1, Number(shopQuantity) || 1),
      Math.max(1, Number(sizes[0]?.quantity) || 1)
    );

    // Insert one row per size entry
    const rows = sizes.map(s => ({
      seller_id: user.id,
      plant_name: plantName.trim(),
      variety: variety.trim() || null,
      quantity: Math.max(1, Number(s.quantity) || 1),
      description: description.trim() || null,
      images: imageUrls,
      category: category || "Other",
      pot_size: s.potSize || null,
    }));

    if (shouldList) {
      // Need the inventory id back to link the listing
      const { data: invRows, error: invErr } = await supabase
        .from("inventory")
        .insert(rows)
        .select("id");
      if (invErr || !invRows?.length) { toast.error(invErr?.message ?? "Failed to save"); setSaving(false); return; }

      const inventoryId = invRows[0].id;
      const { data: listing, error: listErr } = await supabase
        .from("listings")
        .insert({
          seller_id: user.id,
          plant_name: plantName.trim(),
          variety: variety.trim() || null,
          quantity: listedQty,
          description: description.trim() || null,
          images: imageUrls,
          category: category || "Other",
          pot_size: sizes[0].potSize || null,
          price_cents: dollarsToCents(shopPrice),
          inventory_id: inventoryId,
          status: "active",
        })
        .select("id")
        .single();

      if (listErr || !listing) { toast.error(listErr?.message ?? "Failed to create listing"); setSaving(false); return; }

      await supabase.from("inventory").update({
        listing_id: listing.id,
        listing_quantity: listedQty,
      }).eq("id", inventoryId);

      setSaving(false);
      toast.success("Saved to inventory and listed in shop!");
    } else {
      const { error } = await supabase.from("inventory").insert(rows);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
      const label = sizes.length > 1 ? `${sizes.length} sizes added to inventory` : "Saved to inventory!";
      toast.success(label);
    }
    router.push("/dashboard/inventory");
  }

  const canSubmit = plantName.trim() && sizes.every(s => Number(s.quantity) >= 1);

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

      {existingGroup && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/10 dark:border-blue-800 px-4 py-3 mb-6 text-sm">
          <AlertTriangle size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-blue-800 dark:text-blue-400">
              You already have {existingGroup.plant_name} in inventory
            </p>
            <p className="text-blue-700 dark:text-blue-500 mt-0.5">
              Adding this will create a new size variant that groups with your existing {existingGroup.count === 1 ? "entry" : `${existingGroup.count} entries`}.
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
                  <><span className="text-2xl">⏳</span><p className="text-sm text-muted-foreground">Uploading…</p></>
                ) : planLimits.photos !== null && imageUrls.length >= planLimits.photos ? (
                  <><span className="text-3xl">📷</span><p className="text-sm font-medium">Photo limit reached</p><p className="text-xs text-muted-foreground"><Link href="/pricing" className="underline">Upgrade</Link> for more photos</p></>
                ) : (
                  <><span className="text-3xl">📷</span><p className="text-sm font-medium">Drag & drop photos here</p><p className="text-xs text-muted-foreground">or click to browse</p></>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { if (e.target.files) uploadImages(e.target.files); }} />
              {imageUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {imageUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <Image src={url} alt="" width={80} height={80} className="w-20 h-20 object-cover rounded border" />
                      <button type="button" onClick={() => setImageUrls(prev => prev.filter((_, idx) => idx !== i))} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sizes */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Sizes & Quantities</CardTitle>
              <p className="text-xs text-muted-foreground">Each size is saved as a separate inventory row</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {sizes.map((size, idx) => (
              <div key={size.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20">
                <div className="flex-1 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Pot Size <span className="font-normal text-muted-foreground">(optional)</span></Label>
                    <PotSizePicker value={size.potSize} onChange={(v) => updateSize(size.id, "potSize", v)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor={`qty-${size.id}`}>Quantity *</Label>
                    <Input
                      id={`qty-${size.id}`}
                      type="number"
                      min={1}
                      value={size.quantity}
                      onChange={(e) => updateSize(size.id, "quantity", e.target.value)}
                      className="max-w-[120px]"
                    />
                  </div>
                </div>
                {sizes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeSize(size.id)}
                    className="mt-1 p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Remove size ${idx + 1}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addSize} className="flex items-center gap-1.5 text-xs">
              <Plus size={14} /> Add another size
            </Button>
          </CardContent>
        </Card>

        {/* Optional: List in Shop */}
        <Card className="mb-6">
          <CardContent className="pt-5">
            <button
              type="button"
              onClick={() => setListInShop(v => !v)}
              className="flex items-center gap-3 w-full text-left group"
            >
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${listInShop ? "bg-green-600" : "bg-muted-foreground/30"}`}>
                <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${listInShop ? "translate-x-4" : "translate-x-0"}`} />
              </div>
              <div>
                <p className="font-medium flex items-center gap-1.5 text-sm"><Store size={14} /> List in Shop immediately</p>
                <p className="text-xs text-muted-foreground">Set a price and it goes live right away</p>
              </div>
            </button>

            {listInShop && sizes.length > 1 && (
              <p className="mt-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-3 py-2">
                Instant listing is only available when adding a single size. Save first, then list each size from your Inventory page.
              </p>
            )}

            {listInShop && sizes.length === 1 && (
              <div className="mt-4 space-y-3 pl-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="shop-price">Price per item ($) *</Label>
                    <Input
                      id="shop-price"
                      type="number"
                      min={0.01}
                      step={0.01}
                      placeholder="0.00"
                      value={shopPrice}
                      onChange={e => setShopPrice(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="shop-qty">
                      Listed quantity
                      <span className="ml-1 font-normal text-muted-foreground text-xs">(max {sizes[0].quantity || 1})</span>
                    </Label>
                    <Input
                      id="shop-qty"
                      type="number"
                      min={1}
                      max={Number(sizes[0].quantity) || 1}
                      value={shopQuantity || sizes[0].quantity}
                      onChange={e => setShopQuantity(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={saving || !canSubmit || (listInShop && sizes.length === 1 && !shopPrice)} className="bg-green-700 hover:bg-green-800">
            {saving
              ? "Saving…"
              : listInShop && sizes.length === 1 && shopPrice
              ? "Save & List in Shop"
              : sizes.length > 1
              ? `Save ${sizes.length} sizes to Inventory`
              : "Save to Inventory"}
          </Button>
          {!canSubmit && (
            <p className="text-xs text-muted-foreground">Fill in plant name and all quantities to save.</p>
          )}
        </div>
      </form>
    </div>
  );
}
