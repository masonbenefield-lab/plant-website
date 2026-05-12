"use client";

import { useState, useRef, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Upload, X, Loader2, Trash2 } from "lucide-react";

const MAX_PHOTOS = 3;

type Announcement = {
  id: string;
  body: string;
  photos: string[];
  listing_id: string | null;
  created_at: string;
};

interface Props {
  username: string;
  avatarUrl: string | null;
  initialAnnouncements: Announcement[];
}

export default function AnnouncementComposer({ username, avatarUrl, initialAnnouncements }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>(initialAnnouncements);
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(files: FileList) {
    if (photos.length >= MAX_PHOTOS) { toast.error("Max 3 photos per announcement"); return; }
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - photos.length);
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of toUpload) {
      if (file.size > 8 * 1024 * 1024) { toast.error(`${file.name} too large (max 8 MB)`); continue; }
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `announcements/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("listings").upload(path, file);
      if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("listings").getPublicUrl(path);
      urls.push(publicUrl);
    }
    setPhotos((prev) => [...prev, ...urls]);
    setUploading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) { toast.error("Write something first"); return; }
    startTransition(async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("announcements")
        .insert({ seller_id: user.id, body: body.trim(), photos })
        .select("id, body, photos, listing_id, created_at")
        .single();
      if (error) { toast.error("Failed to post announcement"); return; }
      setAnnouncements((prev) => [data as Announcement, ...prev]);
      setBody("");
      setPhotos([]);
      toast.success("Announcement posted");
    });
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("announcements").delete().eq("id", id);
    if (error) { toast.error("Failed to delete"); return; }
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    toast.success("Announcement deleted");
  }

  return (
    <div className="space-y-6">
      {/* Composer */}
      <div className="rounded-xl border bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarImage src={avatarUrl ?? undefined} />
            <AvatarFallback className="bg-green-100 text-green-700 text-sm font-semibold">
              {username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <form onSubmit={handleSubmit} className="flex-1 space-y-3">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Share an update with your followers — new arrivals, restocks, care tips, sales..."
              rows={3}
              className="resize-none"
            />
            {photos.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {photos.map((url) => (
                  <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border group">
                    <Image src={url} alt="Photo" fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((p) => p.filter((u) => u !== url))}
                      className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {photos.length < MAX_PHOTOS && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    Add photo
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                  onChange={(e) => { if (e.target.files?.length) handlePhotoUpload(e.target.files); e.target.value = ""; }} />
                <span className="text-xs text-muted-foreground">{body.length}/500</span>
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || uploading || !body.trim() || body.length > 500}
                className="bg-green-700 hover:bg-green-800"
              >
                {isPending ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                Post
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* Past announcements */}
      {announcements.length === 0 ? (
        <p className="text-sm text-center text-muted-foreground py-8">
          No announcements yet. Post your first update above.
        </p>
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-xl border bg-card p-4 group">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs font-semibold">
                    {username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{username}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(a.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{a.body}</p>
                  {a.photos.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-2">
                      {a.photos.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <div className="relative w-24 h-24 rounded-lg overflow-hidden border hover:opacity-80 transition-opacity">
                            <Image src={url} alt="Announcement photo" fill className="object-cover" />
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-600 transition-all shrink-0"
                  title="Delete announcement"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
