import type { Metadata } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/cart-drawer";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  title: "Plantet — Buy, Sell & Auction Plants",
  description:
    "A marketplace for nurseries and hobbyists to buy, sell, and auction plants.",
  icons: {
    icon: "/plantet-mark-color.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let unreadMessages = 0;
  let pendingReports = 0;
  let pendingSalesOrders = 0;
  if (user) {
    const [{ data }, { count: msgCount }, { count: salesCount }] = await Promise.all([
      supabase.from("profiles").select("username, avatar_url, is_admin").eq("id", user.id).single(),
      supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "paid"),
    ]);
    profile = data;
    unreadMessages = msgCount ?? 0;
    pendingSalesOrders = salesCount ?? 0;
    if (profile?.is_admin) {
      const { count } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingReports = count ?? 0;
    }
  }

  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <CartProvider>
            <div className="w-full bg-sand text-forest text-center text-sm font-medium py-2 px-4">
              🚧 Plantet is currently in development — payments are not active yet. Stay tuned!
            </div>
            <Navbar
              user={user}
              avatarUrl={profile?.avatar_url}
              username={profile?.username}
              isAdmin={profile?.is_admin ?? false}
              unreadMessages={unreadMessages}
              pendingReports={pendingReports}
              pendingSalesOrders={pendingSalesOrders}
            />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
            <Toaster richColors />
          </CartProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
