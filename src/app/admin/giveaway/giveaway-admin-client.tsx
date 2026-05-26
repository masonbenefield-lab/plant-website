"use client";

import { useState } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, ChevronDown, ChevronUp, X } from "lucide-react";

interface GiveawayMonth {
  month: string;
  plant_name: string;
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

export function GiveawayAdminClient({ months }: { months: GiveawayMonth[] }) {
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
                    <Image src={m.image_url} alt={m.plant_name} fill className="object-cover" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-sm">{monthLabel(m.month)}</p>
                  <p className="text-xs text-muted-foreground">{m.plant_name}</p>
                </div>
                {data[m.month]?.sponsor_name && (
                  <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                    Sponsored by {data[m.month].sponsor_name}
                  </span>
                )}
              </div>
              {expandedMonth === m.month ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {expandedMonth === m.month && (
              <div className="border-t px-4 pb-4">
                <SponsorForm
                  month={m.month}
                  initial={data[m.month]}
                  onSave={(updated) => setData((prev) => ({ ...prev, [m.month]: updated }))}
                />
              </div>
            )}
          </CardContent>
        </Card>
      ))}
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
    const supabase = createClient();
    const path = `giveaway-sponsors/${month}-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("garden").upload(path, file, { upsert: true });
    if (error) { toast.error("Logo upload failed"); setUploading(false); return; }
    const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
    setLogoUrl(publicUrl);
    setUploading(false);
    toast.success("Logo uploaded");
  }

  async function handleSave() {
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("giveaway_months")
      .update({
        sponsor_name: name.trim() || null,
        sponsor_username: username.trim() || null,
        sponsor_logo_url: logoUrl || null,
        sponsor_message: message.trim() || null,
      })
      .eq("month", month);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    onSave({ ...initial, sponsor_name: name.trim() || null, sponsor_username: username.trim() || null, sponsor_logo_url: logoUrl || null, sponsor_message: message.trim() || null });
    toast.success("Sponsor saved");
  }

  async function handleClear() {
    setSaving(true);
    const supabase = createClient();
    await supabase.from("giveaway_months").update({ sponsor_name: null, sponsor_username: null, sponsor_logo_url: null, sponsor_message: null }).eq("month", month);
    setSaving(false);
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
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Plantet username (optional)</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Links to their shop"
            className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-muted-foreground">Sponsor message (optional)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="A short note from the sponsor, e.g. 'Specializing in rare tropicals since 2018.'"
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
        />
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Sponsor logo</label>
        <div className="flex items-center gap-3">
          {logoUrl && (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted border shrink-0">
              <Image src={logoUrl} alt="Sponsor logo" fill className="object-contain p-1" />
              <button
                onClick={() => setLogoUrl("")}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-destructive text-white flex items-center justify-center"
              >
                <X size={9} />
              </button>
            </div>
          )}
          <label className="cursor-pointer flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border hover:border-green-400 hover:text-green-700 transition-colors text-muted-foreground">
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
          className="px-4 py-2 text-sm font-medium rounded-md bg-green-700 text-white hover:bg-green-800 disabled:opacity-50 transition-colors flex items-center gap-1.5"
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
