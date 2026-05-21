"use client";

import { useState, useRef } from "react";
import { compressImage } from "@/lib/compress-image";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Camera, X, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 10;

interface Props {
  plantId: string;
  initialImages: string[];
  alt: string;
}

export function PlantPhotoManager({ plantId, initialImages, alt }: Props) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList) {
    const toUpload = Array.from(files).slice(0, MAX_PHOTOS - images.length);
    if (!toUpload.length) return;
    setUploading(true);
    const supabase = createClient();
    const urls: string[] = [];
    for (const rawFile of toUpload) {
      const file = await compressImage(rawFile);
      const path = `garden/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
      const { error } = await supabase.storage.from("garden").upload(path, file);
      if (error) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: { publicUrl } } = supabase.storage.from("garden").getPublicUrl(path);
      urls.push(publicUrl);
    }
    if (!urls.length) { setUploading(false); return; }
    const next = [...images, ...urls];
    const { error } = await supabase
      .from("garden_plants")
      .update({ images: next })
      .eq("id", plantId);
    setUploading(false);
    if (error) { toast.error("Failed to save photos"); return; }
    setImages(next);
    setActiveIndex(next.length - 1);
  }

  async function removePhoto(index: number) {
    const next = images.filter((_, i) => i !== index);
    const supabase = createClient();
    const { error } = await supabase
      .from("garden_plants")
      .update({ images: next })
      .eq("id", plantId);
    if (error) { toast.error("Failed to remove photo"); return; }
    setImages(next);
    setActiveIndex((prev) => Math.min(prev, Math.max(0, next.length - 1)));
  }

  const hasPhotos = images.length > 0;

  return (
    <>
      {/* Main photo area */}
      <div className="relative aspect-video rounded-xl overflow-hidden bg-muted group">
        {hasPhotos ? (
          <Image
            src={images[activeIndex]}
            alt={alt}
            fill
            className="object-cover cursor-zoom-in"
            onClick={() => { setLightboxIndex(activeIndex); setLightboxOpen(true); }}
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
            <span className="text-6xl">🪴</span>
            <p className="text-sm">No photos yet</p>
          </div>
        )}

        {/* Upload overlay button */}
        {images.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "absolute bottom-3 right-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full",
              "bg-black/60 text-white hover:bg-black/80 transition-colors backdrop-blur-sm",
              !hasPhotos && "opacity-100",
              hasPhotos && "opacity-0 group-hover:opacity-100 transition-opacity"
            )}
          >
            {uploading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
            {uploading ? "Uploading…" : hasPhotos ? "Add photo" : "Add photo"}
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* Thumbnail strip */}
      {hasPhotos && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <div key={url} className="relative w-20 h-20 shrink-0 group/thumb">
              <button
                type="button"
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "w-full h-full relative rounded-lg overflow-hidden bg-muted transition-all",
                  i === activeIndex ? "ring-2 ring-green-600 ring-offset-1" : "opacity-60 hover:opacity-100"
                )}
              >
                <Image src={url} alt={`${alt} photo ${i + 1}`} fill className="object-cover" />
              </button>
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity z-10"
                aria-label="Remove photo"
              >
                <X size={11} />
              </button>
            </div>
          ))}
          {images.length < MAX_PHOTOS && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-20 h-20 shrink-0 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-green-400 hover:text-green-700 transition-colors text-xs"
            >
              {uploading ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />}
              <span>Add</span>
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black border-0 overflow-hidden">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="relative w-full" style={{ aspectRatio: "16/9" }}>
            <Image src={images[lightboxIndex]} alt={`${alt} photo ${lightboxIndex + 1}`} fill className="object-contain" />
          </div>
          {images.length > 1 && (
            <>
              <button
                onClick={() => setLightboxIndex((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setLightboxIndex((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Next"
              >
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setLightboxIndex(i)}
                    className={cn("w-1.5 h-1.5 rounded-full transition-colors", i === lightboxIndex ? "bg-white" : "bg-white/40 hover:bg-white/70")}
                    aria-label={`Go to photo ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
