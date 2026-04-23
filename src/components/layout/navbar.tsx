"use client";

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
import type { User } from "@supabase/supabase-js";

interface NavbarProps {
  user: User | null;
  avatarUrl?: string | null;
  username?: string | null;
}

export default function Navbar({ user, avatarUrl, username }: NavbarProps) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="font-bold text-xl text-green-700">
            PlantMarket
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link href="/shop" className="text-muted-foreground hover:text-foreground transition-colors">
              Shop
            </Link>
            <Link href="/auctions" className="text-muted-foreground hover:text-foreground transition-colors">
              Auctions
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-3">
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
                <DropdownMenuItem>
                  <Link href="/dashboard" className="block w-full">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/orders" className="block w-full">My Orders</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href={`/sellers/${username}`} className="block w-full">My Storefront</Link>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Link href="/account" className="block w-full">Account Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="text-red-600">
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: "sm" }), "bg-green-700 hover:bg-green-800")}
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
