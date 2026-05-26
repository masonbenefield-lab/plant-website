"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoGalleryProps {
  images: string[];
  alt: string;
}

export function PhotoGallery({ images, alt }: PhotoGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-6xl">
        🪴
      </div>
    );
  }

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  function lightboxPrev() {
    setLightboxIndex((i) => (i - 1 + images.length) % images.length);
  }

  function lightboxNext() {
    setLightboxIndex((i) => (i + 1) % images.length);
  }

  return (
    <>
      {/* Main photo */}
      <div
        className="aspect-video relative rounded-xl overflow-hidden bg-muted cursor-zoom-in"
        onClick={() => openLightbox(activeIndex)}
      >
        <Image
          src={images[activeIndex]}
          alt={alt}
          fill
          className="object-contain transition-opacity duration-200"
        />
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
          {images.map((url, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveIndex(i)}
              className={cn(
                "w-20 h-20 shrink-0 relative rounded-lg overflow-hidden bg-muted transition-all",
                i === activeIndex
                  ? "ring-2 ring-green-600 ring-offset-1"
                  : "opacity-60 hover:opacity-100"
              )}
            >
              <Image src={url} alt={`${alt} photo ${i + 1}`} fill className="object-cover" />
            </button>
          ))}
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
            <Image
              src={images[lightboxIndex]}
              alt={`${alt} photo ${lightboxIndex + 1}`}
              fill
              className="object-contain"
            />
          </div>

          {images.length > 1 && (
            <>
              <button
                onClick={lightboxPrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                aria-label="Previous"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={lightboxNext}
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
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-colors",
                      i === lightboxIndex ? "bg-white" : "bg-white/40 hover:bg-white/70"
                    )}
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
