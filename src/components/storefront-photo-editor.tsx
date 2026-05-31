"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Camera, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

// ── Banner ───────────────────────────────────────────────────────────────────

export function StorefrontBannerEditor({
  userId,
  initialUrl,
}: {
  userId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/banner.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message || "Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    const res = await fetch("/api/profile/update-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "banner_url", url: cleanUrl }),
    });
    setUploading(false);
    if (!res.ok) { toast.error("Could not save banner"); return; }
    setUrl(`${cleanUrl}?t=${Date.now()}`);
    router.refresh();
    toast.success("Banner updated");
  }

  return (
    <div
      className="relative w-full h-48 sm:h-56 md:h-64 lg:h-72 rounded-2xl overflow-hidden mb-6 cursor-pointer group"
      onClick={() => !uploading && fileInputRef.current?.click()}
    >
      {url ? (
        <Image src={url} alt="Store banner" fill className="object-cover object-center" priority />
      ) : (
        <div className="w-full h-full bg-muted border-2 border-dashed border-border rounded-2xl flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Click to add a banner photo</span>
        </div>
      )}
      <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
        {uploading ? (
          <Loader2 size={32} className="text-white animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-white drop-shadow">
            <Camera size={28} />
            <span className="text-sm font-medium">{url ? "Change banner" : "Add banner"}</span>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}

// ── Avatar ───────────────────────────────────────────────────────────────────

export function StorefrontAvatarEditor({
  userId,
  initialUrl,
  fallback,
}: {
  userId: string;
  initialUrl: string | null;
  fallback: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setUploading(true);
    const supabase = createClient();
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) { toast.error(error.message || "Upload failed"); setUploading(false); return; }
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    const res = await fetch("/api/profile/update-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field: "avatar_url", url: cleanUrl }),
    });
    setUploading(false);
    if (!res.ok) { toast.error("Could not save photo"); return; }
    setUrl(`${cleanUrl}?t=${Date.now()}`);
    router.refresh();
    toast.success("Profile photo updated");
  }

  return (
    <div
      className="relative h-20 w-20 rounded-full cursor-pointer group shrink-0"
      onClick={() => !uploading && fileInputRef.current?.click()}
    >
      {url ? (
        <Image src={url} alt="Profile photo" fill className="object-cover rounded-full" />
      ) : (
        <div className="w-full h-full rounded-full bg-[#DFE7D4] flex items-center justify-center text-leaf text-2xl font-bold">
          {fallback}
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        {uploading ? (
          <Loader2 size={18} className="text-white animate-spin" />
        ) : (
          <Camera size={18} className="text-white drop-shadow" />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />
    </div>
  );
}
