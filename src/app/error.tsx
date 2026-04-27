"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-5xl mb-6">🌿</p>
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        An unexpected error occurred. Try refreshing, or head back to the homepage.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Try again
        </button>
        <Link href="/" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
          Go home
        </Link>
      </div>
    </div>
  );
}
