"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { compressImage } from "@/lib/compress-image";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, X, Trophy, RefreshCw, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface GiveawayMonth {
  month: string;
  plant_name: string;
  description: string | null;
  image_url: string | null;
  sponsor_name: string | null;
  sponsor_username: string | null;
  sponsor_logo_url: string | null;
  sponsor_message: string | null;
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function GiveawayAdminClient({
  months,
  winners,
}: {
  months: GiveawayMonth[];
  winners: Record<string, { username: string; display_name: string | null }>;
}) {
  const [expandedMonth, setExpandedMonth] = useState<string | null>(months[0]?.month ?? null);
  const [data, setData] = useState<Record<string, GiveawayMonth>>(
    Object.fromEntries(months.map((m) => [m.month, m]))
  );

  return (
    <div className="space-y-3">
      {months.map((m) => (
        <Card key={m.month}>
          <CardContent className="p-0">
            <button
              className="w-full flex items-center justify-between p-4 text-left"
              onClick={() => setExpandedMonth(expandedMonth === m.month ? null : m.month)}
            >
              <div className="flex items-center gap-3">
                {m.image_url && (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image_url} alt={m.plant_name} className="w-full h-full object-cover" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{monthLabel(m.month)}</p>
                  <p className="text-xs text-muted-foreground">{m.plant_name}</p>
                </div>
                {data[m.month]?.sponsor_name && (
                  <span className="text-xs bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage px-2 py-0.5 rounded-full font-medium">
                    Sponsored by {data[m.month].sponsor_name}
                  </span>
                )}
              </div>
              {expandedMonth === m.month ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expandedMonth === m.month && (
              <div className="border-t px-4 pb-4 space-y-6">
                <PlantDetailsForm
                  month={m.month}
                  initial={data[m.month]}
                  onSave={(updated) => setData((prev) => ({ ...prev, [m.month]: updated }))}
                />
                <div className="border-t pt-4">
                  <SponsorForm
                    month={m.month}
                    initial={data[m.month]}
                    onSave={(updated) => setData((prev) => ({ ...prev, [m.month]: updated }))}
                  />
                </div>
                <div className="border-t pt-4">
                  <WinnerPicker month={m.month} savedWinner={winners[m.month] ?? null} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function PlantDetailsForm({
  month,
  initial,
  onSave,
}: {
  month: string;
  initial: GiveawayMonth;
  onSave: (updated: GiveawayMonth) => void;
}) {
  const [plantName, setPlantName] = useState(initial.plant_name ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial.image_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    const isHeic = /\.(heic|heif)$/i.test(rawFile.name) || rawFile.type === "image/heic" || rawFile.type === "image/heif";
    if (isHeic) {
      toast.error("HEIC photos aren't supported by browsers. On iPhone, share the photo and choose \"Most Compatible\" format, or convert to JPEG first.", { duration: 6000 });
      return;
    }

    setUploading(true);
    const file = await compressImage(rawFile);
    const path = `giveaway-plants/${month}-${Date.now()}.jpg`;
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    const res = await fetch("/api/admin/upload-giveaway-image", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { toast.error("Image upload failed: " + (data.error ?? "Unknown error")); return; }
    setImageUrl(data.publicUrl);
    toast.success("Image uploaded");
  }

  async function handleSave() {
    if (!plantName.trim()) { toast.error("Plant name is required"); return; }
    setSaving(true);
    const res = await fetch("/api/admin/giveaway-plant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, plant_name: plantName, description, image_url: imageUrl || null }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to save"); return; }
    onSave({ ...initial, plant_name: plantName.trim(), description: description.trim() || null, image_url: imageUrl || null });
    toast.success("Plant details saved");
  }

  return (
    <div className="pt-4 space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Plant Details</p>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Plant name *</label>
        <input
          value={plantName}
          onChange={(e) => setPlantName(e.target.value)}
          placeholder="e.g. Cravens Craving Fig"
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A short description shown on the giveaway page…"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
        />
      </div>
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Plant photo</label>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            {imageUrl && (
              <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted border shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={plantName || "Plant"} className="w-full h-full object-cover" />
                <button
                  onClick={() => setImageUrl("")}
                  className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
                >
                  <X size={9} />
                </button>
              </div>
            )}
            <label className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border hover:border-sage hover:text-leaf transition-colors text-muted-foreground">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
              {uploading ? "Uploading…" : imageUrl ? "Replace photo" : "Upload photo"}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
          {imageUrl && (
            <p className="text-[10px] text-muted-foreground break-all font-mono bg-muted/50 px-2 py-1 rounded">
              {imageUrl}
            </p>
          )}
        </div>
      </div>
      <button
        onClick={handleSave}
        disabled={saving || !plantName.trim()}
        className="px-4 py-2 text-sm font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors flex items-center gap-1.5"
      >
        {saving ? <Loader2 size={13} className="animate-spin" /> : null}
        Save plant details
      </button>
    </div>
  );
}

function SponsorForm({
  month,
  initial,
  onSave,
}: {
  month: string;
  initial: GiveawayMonth;
  onSave: (updated: GiveawayMonth) => void;
}) {
  const [name, setName] = useState(initial.sponsor_name ?? "");
  const [username, setUsername] = useState(initial.sponsor_username ?? "");
  const [message, setMessage] = useState(initial.sponsor_message ?? "");
  const [logoUrl, setLogoUrl] = useState(initial.sponsor_logo_url ?? "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `giveaway-sponsors/${month}-${Date.now()}.${file.name.split(".").pop()}`;
    const form = new FormData();
    form.append("file", file);
    form.append("path", path);
    const res = await fetch("/api/admin/upload-giveaway-image", { method: "POST", body: form });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) { toast.error("Logo upload failed: " + (data.error ?? "Unknown error")); return; }
    setLogoUrl(data.publicUrl);
    toast.success("Logo uploaded");
  }

  async function saveSponsor(payload: { sponsor_name: string | null; sponsor_username: string | null; sponsor_logo_url: string | null; sponsor_message: string | null }) {
    const res = await fetch("/api/admin/giveaway-sponsor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed to save"); return false; }
    return true;
  }

  async function handleSave() {
    setSaving(true);
    const ok = await saveSponsor({
      sponsor_name: name.trim() || null,
      sponsor_username: username.trim() || null,
      sponsor_logo_url: logoUrl || null,
      sponsor_message: message.trim() || null,
    });
    setSaving(false);
    if (!ok) return;
    onSave({ ...initial, sponsor_name: name.trim() || null, sponsor_username: username.trim() || null, sponsor_logo_url: logoUrl || null, sponsor_message: message.trim() || null });
    toast.success("Sponsor saved");
  }

  async function handleClear() {
    setSaving(true);
    const ok = await saveSponsor({ sponsor_name: null, sponsor_username: null, sponsor_logo_url: null, sponsor_message: null });
    setSaving(false);
    if (!ok) return;
    setName(""); setUsername(""); setMessage(""); setLogoUrl("");
    onSave({ ...initial, sponsor_name: null, sponsor_username: null, sponsor_logo_url: null, sponsor_message: null });
    toast.success("Sponsor cleared");
  }

  return (
    <div className="pt-4 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Sponsor name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Green Thumb Nursery"
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Plantet username (optional)</label>
          <UsernameTypeahead value={username} onChange={setUsername} />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Sponsor message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A short note from the sponsor, e.g. 'Specializing in rare tropicals since 2018.'"
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Sponsor logo</label>
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted border shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="Sponsor logo" className="w-full h-full object-contain p-1" />
              <button
                onClick={() => setLogoUrl("")}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
              >
                <X size={9} />
              </button>
            </div>
          )}
          <label className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border hover:border-sage hover:text-leaf transition-colors text-muted-foreground">
            {uploading ? <Loader2 size={14} className="animate-spin" /> : null}
            {uploading ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="px-4 py-2 text-sm font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : null}
          Save sponsor
        </button>
        {initial.sponsor_name && (
          <button
            onClick={handleClear}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-md border border-border hover:bg-muted transition-colors text-muted-foreground"
          >
            Clear sponsor
          </button>
        )}
      </div>
    </div>
  );
}

interface PickedUser {
  rank: number;
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  base_entries: number;
  bonus_entries: number;
  total_entries: number;
  total_pool: number;
}

function WinnerPicker({
  month,
  savedWinner,
}: {
  month: string;
  savedWinner: { username: string; display_name: string | null } | null;
}) {
  const [picking, setPicking] = useState(false);
  const [results, setResults] = useState<PickedUser[] | null>(null);
  const [totalEntrants, setTotalEntrants] = useState(0);
  const [totalPool, setTotalPool] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const savedName = savedWinner ? savedWinner.display_name || savedWinner.username : null;
  const alreadyPicked = Boolean(savedWinner);

  async function handlePick() {
    setPicking(true);
    setResults(null);
    setSaved(false);
    const res = await fetch("/api/admin/giveaway-pick-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    const data = await res.json();
    setPicking(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to pick winner"); return; }
    setResults(data.results);
    setTotalEntrants(data.total_entrants);
    setTotalPool(data.total_pool);
  }

  async function handleSave(userId: string) {
    setSaving(true);
    const res = await fetch("/api/admin/giveaway-save-winner", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month, winner_user_id: userId }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { toast.error(data.error ?? "Failed to save winner"); return; }
    setSaved(true);
    toast.success("Winner saved!");
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Pick Winner</p>
        <button
          onClick={handlePick}
          disabled={picking}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors"
        >
          {picking ? <Loader2 size={12} className="animate-spin" /> : (results || alreadyPicked) ? <RefreshCw size={12} /> : <Trophy size={12} />}
          {picking ? "Drawing…" : results ? "Re-roll" : alreadyPicked ? "Re-draw" : "Draw winner"}
        </button>
      </div>

      {alreadyPicked && !results && (
        <div className="flex items-center gap-2 rounded-lg border border-sage dark:border-leaf bg-[#EBF0E6] dark:bg-forest/20 p-3">
          <Trophy size={14} className="text-amber-500 shrink-0" />
          <p className="text-sm">
            <span className="font-semibold">Winner already picked:</span> {savedName}
          </p>
        </div>
      )}

      {results && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {totalEntrants} {totalEntrants === 1 ? "entrant" : "entrants"} · {totalPool} weighted slots
          </p>
          {results.map((r) => (
            <div
              key={r.user_id}
              className={cn(
                "flex items-center gap-3 rounded-lg border p-3",
                r.rank === 0 && "border-sage dark:border-leaf bg-[#EBF0E6] dark:bg-forest/20"
              )}
            >
              <div className="w-8 h-8 rounded-full bg-muted overflow-hidden shrink-0 border">
                {r.avatar_url ? (
                  <Image src={r.avatar_url} alt={r.username} width={32} height={32} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {r.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {r.rank === 0 && <Trophy size={12} className="text-amber-500 shrink-0" />}
                  <p className="text-sm font-semibold truncate">{r.username}</p>
                  {r.display_name && <p className="text-xs text-muted-foreground truncate">· {r.display_name}</p>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.rank === 0 ? "Winner" : `Backup #${r.rank}`} · {r.total_entries} {r.total_entries === 1 ? "entry" : "entries"}
                  {r.bonus_entries > 0 && <span className="text-leaf"> (+{r.bonus_entries} referral)</span>}
                </p>
              </div>
              {r.rank === 0 && (
                <button
                  onClick={() => handleSave(r.user_id)}
                  disabled={saving || saved}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-leaf text-white hover:bg-forest disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : saved ? <Check size={11} /> : null}
                  {saved ? "Saved!" : "Confirm winner"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

function UsernameTypeahead({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [results, setResults] = useState<UserResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const res = await fetch(`/api/admin/search-users?q=${encodeURIComponent(value)}`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      setOpen(true);
      setLoading(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function select(user: UserResult) {
    onChange(user.username);
    setOpen(false);
    setResults([]);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by username…"
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-leaf"
          autoComplete="off"
        />
        {loading && (
          <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border bg-popover shadow-lg overflow-hidden">
          {results.map((u) => (
            <button
              key={u.id}
              type="button"
              onMouseDown={() => select(u)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-full bg-muted overflow-hidden shrink-0 border">
                {u.avatar_url ? (
                  <Image src={u.avatar_url} alt={u.username} width={28} height={28} className="object-cover w-full h-full" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                    {u.username.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{u.username}</p>
                {u.display_name && (
                  <p className="text-xs text-muted-foreground truncate">{u.display_name}</p>
                )}
              </div>
            </button>
          ))}
          {results.length === 0 && !loading && (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">No users found</p>
          )}
        </div>
      )}

      {open && !loading && results.length === 0 && value.trim().length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-lg border bg-popover shadow-lg px-3 py-2.5">
          <p className="text-sm text-muted-foreground">No users found for &ldquo;{value}&rdquo;</p>
        </div>
      )}
    </div>
  );
}
