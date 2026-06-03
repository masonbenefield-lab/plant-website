"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function GardenTabs() {
  const pathname = usePathname();
  const isCommunity = pathname.startsWith("/garden/community");
  const isWishlist = pathname.startsWith("/garden/wishlist");
  const isCare = pathname.startsWith("/garden/care");
  const isMyGarden = !isCommunity && !isWishlist && !isCare;

  return (
    <div className="flex gap-1 border-b mb-6">
      <TabLink href="/garden" active={isMyGarden}>My Garden</TabLink>
      <TabLink href="/garden/care" active={isCare}>Care Schedule</TabLink>
      <TabLink href="/garden/community" active={isCommunity}>Community Gardens</TabLink>
      <TabLink href="/garden/wishlist" active={isWishlist}>Wishlist</TabLink>
    </div>
  );
}

function TabLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
        active
          ? "border-leaf text-leaf"
          : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
      )}
    >
      {children}
    </Link>
  );
}
