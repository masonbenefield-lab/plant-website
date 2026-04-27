import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <p className="text-5xl mb-6">🌿</p>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        This page doesn&apos;t exist or may have been removed.
      </p>
      <Link href="/" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
        Go home
      </Link>
    </div>
  );
}
