"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { Search, Heart, Package, Rss } from "lucide-react";
import { CartButton } from "@/components/cart-drawer";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
  avatarUrl?: string | null;
  username?: string | null;
  isAdmin?: boolean;
}

export default function Navbar({ user, avatarUrl, username, isAdmin }: NavbarProps) {
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setMobileOpen(false);
    router.push("/");
    router.refresh();
  }

  function closeMenu() {
    setMobileOpen(false);
  }

  return (
    <header className="border-b bg-background sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">

        {/* Left: logo + desktop nav */}
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-xl text-green-700" onClick={closeMenu}>
            Plantet
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/shop" className="text-muted-foreground hover:text-foreground transition-colors">
              Shop
            </Link>
            <Link href="/auctions" className="text-muted-foreground hover:text-foreground transition-colors">
              Auctions
            </Link>
            <Link href="/search" className="text-muted-foreground hover:text-foreground transition-colors">
              Search
            </Link>
            <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
          </nav>
        </div>

        {/* Right: desktop auth + mobile hamburger */}
        <div className="flex items-center gap-3">
          {/* Desktop auth */}
          <div className="hidden md:flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-1 mr-1">
                <Link href="/search" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Search">
                  <Search size={17} />
                </Link>
                <Link href="/wishlist" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Wishlist">
                  <Heart size={17} />
                </Link>
                <Link href="/orders" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="My Orders">
                  <Package size={17} />
                </Link>
                <Link href="/feed" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Feed">
                  <Rss size={17} />
                </Link>
                <CartButton />
              </div>
            )}
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={avatarUrl ?? undefined} />
                    <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                      {username?.slice(0, 2).toUpperCase() ?? "??"}
                    </AvatarFallback>
                  </Avatar>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem><Link href="/dashboard" className="block w-full">Dashboard</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/dashboard/inventory" className="block w-full">Inventory</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/dashboard/offers" className="block w-full">Offers</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/wishlist" className="block w-full">Wishlist</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/orders" className="block w-full">My Orders</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/feed" className="block w-full">Feed</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href={`/sellers/${username}`} className="block w-full">My Storefront</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/account" className="block w-full">Account Settings</Link></DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem><Link href="/admin" className="block w-full font-medium text-orange-600">Admin Panel</Link></DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="text-red-600">Sign out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Link href="/login" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>Sign in</Link>
                <Link href="/signup" className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}>Get started</Link>
              </>
            )}
          </div>

          {/* Theme toggle — always visible */}
          <ThemeToggle />

          {/* Mobile hamburger button */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg hover:bg-muted transition-colors"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="16" y2="16" />
                <line x1="16" y1="2" x2="2" y2="16" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="5" x2="16" y2="5" />
                <line x1="2" y1="9" x2="16" y2="9" />
                <line x1="2" y1="13" x2="16" y2="13" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t bg-background px-4 py-4 space-y-1">
          <MobileLink href="/shop" onClick={closeMenu}>Shop</MobileLink>
          <MobileLink href="/auctions" onClick={closeMenu}>Auctions</MobileLink>
          <MobileLink href="/search" onClick={closeMenu}>Search</MobileLink>
          <MobileLink href="/pricing" onClick={closeMenu}>Pricing</MobileLink>

          {user ? (
            <>
              <div className="border-t my-3" />
              <div className="flex items-center gap-3 px-3 py-2 mb-1">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-green-100 text-green-700 text-xs">
                    {username?.slice(0, 2).toUpperCase() ?? "??"}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{username}</span>
              </div>
              <MobileLink href="/dashboard" onClick={closeMenu}>Dashboard</MobileLink>
              <MobileLink href="/dashboard/inventory" onClick={closeMenu}>Inventory</MobileLink>
              <MobileLink href="/wishlist" onClick={closeMenu}>Wishlist</MobileLink>
              <MobileLink href="/orders" onClick={closeMenu}>My Orders</MobileLink>
              <MobileLink href={`/sellers/${username}`} onClick={closeMenu}>My Storefront</MobileLink>
              <MobileLink href="/account" onClick={closeMenu}>Account Settings</MobileLink>
              {isAdmin && <MobileLink href="/admin" onClick={closeMenu}>Admin Panel</MobileLink>}
              <div className="border-t my-3" />
              <button
                onClick={signOut}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="border-t my-3" />
              <div className="flex flex-col gap-2 pt-1">
                <Link
                  href="/login"
                  onClick={closeMenu}
                  className={cn(buttonVariants({ variant: "outline" }), "w-full justify-center")}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  onClick={closeMenu}
                  className={cn(buttonVariants(), "w-full justify-center bg-green-700 hover:bg-green-800")}
                >
                  Get started
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </header>
  );
}

function MobileLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors"
    >
      {children}
    </Link>
  );
}
