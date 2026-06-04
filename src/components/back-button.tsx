"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className={cn("inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors", className)}
    >
      <ChevronLeft size={16} />
      Back
    </button>
  );
}
