"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star, X, ImagePlus } from "lucide-react";
import { toast } from "sonner";
import { findProhibitedWord, censorWord, logViolation } from "@/lib/profanity";
import { createClient } from "@/lib/supabase/client";

const MAX_PHOTOS = 3;

export default function RateSellerForm({
  orderId,
  sellerUsername,
}: {
  orderId: string;
  sellerUsername: string;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [score, setScore] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const remaining = MAX_PHOTOS - photoUrls.length;
    if (remaining <= 0) return;
    const toUpload = files.slice(0, remaining);

    setUploading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const newUrls: string[] = [];
    for (const file of toUpload) {
      const path = `reviews/${user.id}/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from("listings").upload(path, file, { upsert: true });
      if (error) { toast.error(`Upload failed: ${error.message}`); continue; }
      const { data } = supabase.storage.from("listings").getPublicUrl(path);
      newUrls.push(data.publicUrl);
    }
    setPhotoUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
    e.target.value = "";
  }

  function removePhoto(url: string) {
    setPhotoUrls((prev) => prev.filter((u) => u !== url));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!score) return toast.error("Please select a star rating");
    if (comment) {
      const hit = findProhibitedWord(comment);
      if (hit) {
        toast.error(`Your review contains a prohibited word: "${censorWord(hit)}"`);
        logViolation(hit, "review-comment", comment);
        return;
      }
    }
    setSaving(true);

    const res = await fetch("/api/ratings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, score, comment, photos: photoUrls }),
    });
    const data = await res.json();

    setSaving(false);
    if (data.error) {
      toast.error(data.error);
    } else {
      toast.success(`Review submitted for ${sellerUsername}`);
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-sm font-medium">Rate {sellerUsername}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setScore(n)}
          >
            <Star
              className={`h-6 w-6 transition-colors ${
                n <= (hover || score)
                  ? "fill-yellow-400 text-yellow-400"
                  : "text-gray-300"
              }`}
            />
          </button>
        ))}
      </div>
      <Textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a comment (optional)"
        rows={2}
        maxLength={500}
      />

      {/* Photo upload */}
      <div className="space-y-2">
        <div className="flex gap-2 flex-wrap">
          {photoUrls.map((url) => (
            <div key={url} className="relative group">
              <Image
                src={url}
                alt="Review photo"
                width={72}
                height={72}
                className="rounded-md object-cover border"
              />
              <button
                type="button"
                onClick={() => removePhoto(url)}
                className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          {photoUrls.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="w-[72px] h-[72px] rounded-md border-2 border-dashed border-border flex flex-col items-center justify-center text-muted-foreground hover:border-foreground hover:text-foreground transition-colors text-xs gap-1"
            >
              <ImagePlus size={16} />
              {uploading ? "…" : "Add"}
            </button>
          )}
        </div>
        {photoUrls.length < MAX_PHOTOS && (
          <p className="text-xs text-muted-foreground">Up to {MAX_PHOTOS} photos (optional)</p>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoChange} />
      </div>

      <Button
        type="submit"
        size="sm"
        disabled={saving || uploading}
        className="bg-green-700 hover:bg-green-800"
      >
        {saving ? "Submitting…" : "Submit Review"}
      </Button>
    </form>
  );
}
