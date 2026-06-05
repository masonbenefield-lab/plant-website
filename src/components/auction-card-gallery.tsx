"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function AuctionCardGallery({ images, alt }: { images: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);

  if (!images.length) {
    return (
      <div className="relative aspect-[4/3] bg-muted flex items-center justify-center text-4xl">🌿</div>
    );
  }

  return (
    <div className="relative aspect-[4/3] bg-muted">
      <Image src={images[idx]} alt={alt} fill className="object-contain" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
      {idx > 0 && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => i - 1); }}
          aria-label="Previous photo"
          className="absolute left-1.5 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
      )}
      {idx < images.length - 1 && (
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx((i) => i + 1); }}
          aria-label="Next photo"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-0.5 transition-colors"
        >
          <ChevronRight size={18} />
        </button>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 pointer-events-none">
          {images.map((_, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === idx ? "bg-white" : "bg-white/50"}`} />
          ))}
        </div>
      )}
    </div>
  );
}
