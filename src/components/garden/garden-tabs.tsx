"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function GardenTabs({ basePath = "/garden" }: { basePath?: string }) {
  const pathname = usePathname();
  const isCommunity = pathname.startsWith(`${basePath}/community`);
  const isWishlist = pathname.startsWith(`${basePath}/wishlist`);
  const isCare = pathname.startsWith(`${basePath}/care`);
  const isMyGarden = !isCommunity && !isWishlist && !isCare;

  return (
    <div className="flex gap-1 border-b mb-6 overflow-x-auto [&::-webkit-scrollbar]:hidden scrollbar-none">
      <TabLink href={basePath} active={isMyGarden}>My Garden</TabLink>
      <TabLink href={`${basePath}/care`} active={isCare}><span className="sm:hidden">Care</span><span className="hidden sm:inline">Care Schedule</span></TabLink>
      <TabLink href={`${basePath}/community`} active={isCommunity}><span className="sm:hidden">Community</span><span className="hidden sm:inline">Community Gardens</span></TabLink>
      <TabLink href={`${basePath}/wishlist`} active={isWishlist}>Wishlist</TabLink>
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
