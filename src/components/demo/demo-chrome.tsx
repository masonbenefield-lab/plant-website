import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Banner shown at the top of every demo tab so it's unmistakably an example. */
export function DemoBanner() {
  return (
    <div className="rounded-xl border border-leaf/30 bg-[#EBF0E6] dark:bg-forest/20 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-forest dark:text-sage">
        <span className="font-semibold">👋 This is a live example garden.</span>{" "}
        Browse the tabs to see how Plantet keeps your collection on track — then start your own, free.
      </p>
      <Link
        href="/signup"
        className={cn(buttonVariants({ size: "sm" }), "bg-leaf hover:bg-forest text-white shrink-0")}
      >
        Start my garden free →
      </Link>
    </div>
  );
}

/** Header action buttons on demo tabs — styled like the real ones but route to signup. */
export function DemoHeaderActions() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href="/signup" className={cn(buttonVariants({ variant: "outline" }))}>
        Bulk Upload
      </Link>
      <Link href="/signup" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
        + Add Plant
      </Link>
    </div>
  );
}
