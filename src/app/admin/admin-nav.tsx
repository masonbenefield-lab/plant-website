"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin",             label: "Overview" },
  { href: "/admin/users",       label: "Users" },
  { href: "/admin/listings",    label: "Listings" },
  { href: "/admin/auctions",    label: "Auctions" },
  { href: "/admin/orders",      label: "Orders" },
  { href: "/admin/reports",     label: "Reports" },
  { href: "/admin/violations",  label: "Violations" },
];

export default function AdminNav({ pendingReports = 0, repeatViolators = 0 }: { pendingReports?: number; repeatViolators?: number }) {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 border-r bg-muted/20 px-3 py-6">
      <p className="px-3 mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Admin Panel
      </p>
      <nav className="space-y-0.5">
        {links.map((link) => {
          const active = link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          const isReports = link.href === "/admin/reports";
          const isViolations = link.href === "/admin/violations";
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                  : "text-foreground hover:bg-muted"
              )}
            >
              {link.label}
              {isReports && pendingReports > 0 && (
                <span className="ml-2 rounded-full bg-red-500 text-white text-xs px-1.5 py-0.5 font-semibold leading-none">
                  {pendingReports}
                </span>
              )}
              {isViolations && repeatViolators > 0 && (
                <span className="ml-2 rounded-full bg-orange-500 text-white text-xs px-1.5 py-0.5 font-semibold leading-none">
                  {repeatViolators}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
