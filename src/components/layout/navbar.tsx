"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
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
import { Search, Heart, Package, Rss, Sprout, MessageSquare, Users } from "lucide-react";
import { CartButton } from "@/components/cart-drawer";
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
  avatarUrl?: string | null;
  username?: string | null;
  isAdmin?: boolean;
  unreadMessages?: number;
}

export default function Navbar({ user, avatarUrl, username, isAdmin, unreadMessages = 0 }: NavbarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuTop, setMenuTop] = useState(64);
  const [liveUnread, setLiveUnread] = useState(unreadMessages);
  const [hasNewFeed, setHasNewFeed] = useState(false);

  const fetchUnreadCount = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/messages/unread-count");
    if (res.ok) {
      const { count } = await res.json();
      setLiveUnread(count);
    }
  }, [user]);

  const fetchFeedBadge = useCallback(async () => {
    if (!user) return;
    const res = await fetch("/api/feed/unread-count");
    if (res.ok) {
      const { hasNew } = await res.json();
      setHasNewFeed(hasNew);
    }
  }, [user]);

  // Lock body scroll and track header bottom when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      function updateTop() {
        if (headerRef.current) {
          setMenuTop(headerRef.current.getBoundingClientRect().bottom);
        }
      }
      updateTop();
      window.addEventListener("scroll", updateTop, { passive: true });
      window.addEventListener("resize", updateTop);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("scroll", updateTop);
        window.removeEventListener("resize", updateTop);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileOpen]);

  // Refresh counts on mount and whenever the route changes
  useEffect(() => {
    fetchUnreadCount();
    if (pathname === "/feed") {
      setHasNewFeed(false);
    } else {
      fetchFeedBadge();
    }
  }, [fetchUnreadCount, fetchFeedBadge, pathname]);

  // Subscribe to new messages via Realtime
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    const channel = supabase
      .channel("navbar-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          if (payload.new.sender_id !== user.id) {
            setLiveUnread((prev) => prev + 1);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages" },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchUnreadCount]);

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
    <header ref={headerRef} className="border-b bg-background sticky top-0 z-50">
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
            <Link href="/community" className="text-muted-foreground hover:text-foreground transition-colors">
              Community
            </Link>
            <Link href="/giveaway" className="text-muted-foreground hover:text-foreground transition-colors">
              Giveaway
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
              <div className="flex items-center gap-0.5 mr-1">
                <NavIcon href="/search" label="Search"><Search size={15} /></NavIcon>
                <NavIcon href="/wishlist" label="Wishlist"><Heart size={15} /></NavIcon>
                <NavIcon href="/orders" label="Orders"><Package size={15} /></NavIcon>
                <Link href="/feed" className="relative flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <Rss size={15} />
                  {hasNewFeed && (
                    <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-green-500" />
                  )}
                  <span className="text-[9px] leading-none font-medium">Feed</span>
                </Link>
                <NavIcon href="/garden" label="Garden"><Sprout size={15} /></NavIcon>
                <NavIcon href="/following" label="Following"><Users size={15} /></NavIcon>
                <Link href="/messages" className="relative flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MessageSquare size={15} />
                  {liveUnread > 0 && (
                    <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-green-600 text-white text-[9px] font-bold flex items-center justify-center">
                      {liveUnread > 9 ? "9+" : liveUnread}
                    </span>
                  )}
                  <span className="text-[9px] leading-none font-medium">Messages</span>
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
                  <DropdownMenuItem><Link href="/dashboard/inventory" className="block w-full">My Stock</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/dashboard/offers" className="block w-full">Offers</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/dashboard/auctions" className="block w-full">Auctions</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/wishlist" className="block w-full">Wishlist</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/orders" className="block w-full">My Purchases</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/feed" className="block w-full">Feed</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/messages" className="block w-full">Messages{liveUnread > 0 ? ` (${liveUnread})` : ""}</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/following" className="block w-full">Following</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/community" className="block w-full">Community</Link></DropdownMenuItem>
                  <DropdownMenuItem><Link href="/garden" className="block w-full">My Garden</Link></DropdownMenuItem>
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

      {/* Mobile menu — fixed overlay anchored to actual header bottom */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-background overflow-y-auto border-t px-4 py-4 space-y-1"
          style={{ top: menuTop }}
        >
          <MobileLink href="/shop" onClick={closeMenu}>Shop</MobileLink>
          <MobileLink href="/auctions" onClick={closeMenu}>Auctions</MobileLink>
          <MobileLink href="/community" onClick={closeMenu}>Community</MobileLink>
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
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Shopping</p>
              <MobileLink href="/dashboard/auctions" onClick={closeMenu}>Auctions</MobileLink>
              <MobileLink href="/wishlist" onClick={closeMenu}>Wishlist</MobileLink>
              <MobileLink href="/orders" onClick={closeMenu}>My Purchases</MobileLink>
              <MobileLink href="/messages" onClick={closeMenu}>Messages{liveUnread > 0 ? ` (${liveUnread})` : ""}</MobileLink>

              <div className="border-t my-2" />
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Selling</p>
              <MobileLink href="/dashboard" onClick={closeMenu}>Dashboard</MobileLink>
              <MobileLink href="/dashboard/inventory" onClick={closeMenu}>My Stock</MobileLink>
              <MobileLink href="/dashboard/announcements" onClick={closeMenu}>Announcements</MobileLink>
              <MobileLink href={`/sellers/${username}`} onClick={closeMenu}>My Storefront</MobileLink>
              <MobileLink href="/account" onClick={closeMenu}>Account Settings</MobileLink>

              <div className="border-t my-2" />
              <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Community</p>
              <MobileLink href="/feed" onClick={closeMenu}>Feed</MobileLink>
              <MobileLink href="/garden" onClick={closeMenu}>My Garden</MobileLink>
              <MobileLink href="/following" onClick={closeMenu}>Following</MobileLink>
              <MobileLink href="/community" onClick={closeMenu}>Community</MobileLink>
              <MobileLink href="/giveaway" onClick={closeMenu}>Giveaway</MobileLink>

              {isAdmin && (
                <>
                  <div className="border-t my-2" />
                  <MobileLink href="/admin" onClick={closeMenu}>Admin Panel</MobileLink>
                </>
              )}
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

function NavIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title={label}>
      {children}
      <span className="text-[9px] leading-none font-medium">{label}</span>
    </Link>
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
