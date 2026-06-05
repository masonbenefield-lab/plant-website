"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [selected, setSelected] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const close = useCallback(() => setLightboxOpen(false), []);
  const prev = useCallback(() => setSelected((i) => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setSelected((i) => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, close, prev, next]);

  if (!images.length) {
    return (
      <div className="relative h-96 rounded-xl overflow-hidden bg-muted flex items-center justify-center text-6xl">
        🌿
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Main photo */}
        <button
          className="relative aspect-[4/3] w-full rounded-xl overflow-hidden bg-muted cursor-zoom-in"
          onClick={() => setLightboxOpen(true)}
          aria-label={`View ${alt} — click to open full-size`}
        >
          <Image src={images[selected]} alt={alt} fill className="object-contain" priority />
        </button>

        {/* Thumbnails */}
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Image thumbnails">
            {images.map((url, i) => (
              <button
                key={i}
                role="listitem"
                onClick={() => setSelected(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-pressed={i === selected}
                className={`relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === selected ? "border-leaf" : "border-transparent hover:border-sage"
                }`}
              >
                <Image src={url} alt={`${alt} — image ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — image ${selected + 1} of ${images.length}`}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={close}
        >
          <button
            onClick={(e) => { e.stopPropagation(); close(); }}
            aria-label="Close image viewer"
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors z-10"
          >
            <X size={28} />
          </button>

          {images.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); prev(); }}
                aria-label="Previous image"
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors z-10"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); next(); }}
                aria-label="Next image"
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white bg-black/40 hover:bg-black/60 rounded-full p-2 transition-colors z-10"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}

          <div
            className="relative w-full h-full max-w-4xl max-h-[85vh] mx-16"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[selected]}
              alt={`${alt} — image ${selected + 1} of ${images.length}`}
              fill
              className="object-contain"
            />
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2" role="tablist" aria-label="Image navigation">
              {images.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === selected}
                  aria-label={`Go to image ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setSelected(i); }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === selected ? "bg-white" : "bg-white/40 hover:bg-white/70"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
