import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  prevHref: string | null;
  nextHref: string | null;
}

export function Pagination({ page, totalPages, total, pageSize, prevHref, nextHref }: PaginationProps) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between mt-8 pt-6 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-2">
        {prevHref ? (
          <Link href={prevHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <ChevronLeft size={16} className="mr-1" />Prev
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-40 pointer-events-none")}>
            <ChevronLeft size={16} className="mr-1" />Prev
          </span>
        )}
        <span className="text-sm text-muted-foreground tabular-nums">{page} / {totalPages}</span>
        {nextHref ? (
          <Link href={nextHref} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            Next<ChevronRight size={16} className="ml-1" />
          </Link>
        ) : (
          <span className={cn(buttonVariants({ variant: "outline", size: "sm" }), "opacity-40 pointer-events-none")}>
            Next<ChevronRight size={16} className="ml-1" />
          </span>
        )}
      </div>
    </div>
  );
}
