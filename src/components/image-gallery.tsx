"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export default function ImageGallery({ images, alt }: { images: string[]; alt: string }) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const close = useCallback(() => setLightboxIndex(null), []);
  const prev = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i - 1 + images.length) % images.length : null)),
    [images.length]
  );
  const next = useCallback(
    () => setLightboxIndex((i) => (i !== null ? (i + 1) % images.length : null)),
    [images.length]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
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
  }, [lightboxIndex, close, prev, next]);

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
        <button
          className="relative h-96 w-full rounded-xl overflow-hidden bg-muted cursor-zoom-in"
          onClick={() => setLightboxIndex(0)}
          aria-label={`View ${alt} — click to open full-size`}
        >
          <Image src={images[0]} alt={alt} fill className="object-cover" />
        </button>
        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Image thumbnails">
            {images.map((url, i) => (
              <button
                key={i}
                role="listitem"
                onClick={() => setLightboxIndex(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-pressed={i === 0}
                className={`relative h-20 w-20 flex-shrink-0 rounded-lg overflow-hidden border-2 transition-colors ${
                  i === 0 ? "border-green-600" : "border-transparent hover:border-green-400"
                }`}
              >
                <Image src={url} alt={`${alt} — image ${i + 1}`} fill className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${alt} — image ${lightboxIndex + 1} of ${images.length}`}
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
              src={images[lightboxIndex]}
              alt={`${alt} — image ${lightboxIndex + 1} of ${images.length}`}
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
                  aria-selected={i === lightboxIndex}
                  aria-label={`Go to image ${i + 1}`}
                  onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === lightboxIndex ? "bg-white" : "bg-white/40 hover:bg-white/70"
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
