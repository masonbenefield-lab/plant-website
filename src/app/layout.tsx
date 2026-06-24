import type { Metadata, Viewport } from "next";
import { Inter, Bricolage_Grotesque } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { ThemeProvider } from "@/components/theme-provider";
import { CartProvider } from "@/lib/cart";
import { CartDrawer } from "@/components/cart-drawer";
import { Analytics } from "@vercel/analytics/next";
import { PushNotificationProvider } from "@/components/push-notification-provider";
import SessionTracker from "@/components/session-tracker";
import { createClient } from "@/lib/supabase/server";
import { unstable_noStore as noStore } from "next/cache";
import Script from "next/script";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["700"],
});

const siteUrl = "https://www.plantet.shop";

export const viewport: Viewport = {
  themeColor: "#2F7D54",
  // Draw into the iOS safe areas so env(safe-area-inset-*) is available;
  // the navbar adds top padding to cover the status-bar strip.
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Plantet — Your Plants. Your People. Your Garden.",
  other: {
    "msvalidate.01": "FCF283760296C32C971F534080A523B1",
  },
  description:
    "Track your plants, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.",
  icons: {
    icon: "/plantet-mark-color.svg",
    apple: "/plantet-app-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Plantet",
  },
  openGraph: {
    title: "Plantet — Your Plants. Your People. Your Garden.",
    description: "Track your plants, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.",
    siteName: "Plantet",
    url: siteUrl,
    type: "website",
    images: [
      {
        url: `${siteUrl}/plantet-facebook-green.png`,
        width: 1200,
        height: 630,
        alt: "Plantet — Your Plants. Your People. Your Garden.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Plantet — Your Plants. Your People. Your Garden.",
    description: "Track your plants, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.",
    images: [`${siteUrl}/plantet-facebook-green.png`],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  noStore();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile = null;
  let unreadMessages = 0;
  let pendingReports = 0;
  let pendingSalesOrders = 0;
  let pendingBuyerPayments = 0;
  let actionableDisputeCount = 0;
  let pendingTrades = 0;
  if (user) {
    const [{ data }, { count: msgCount }, { count: salesCount }, { count: sellerDisputeCount }, { count: buyerDisputeCount }, { count: buyerPendingCount }, { count: tradeCount }] = await Promise.all([
      supabase.from("profiles").select("username, avatar_url, is_admin").eq("id", user.id).single(),
      supabase.from("messages").select("id", { count: "exact", head: true }).is("read_at", null).neq("sender_id", user.id),
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "paid"),
      // Seller: disputes filed against them that need a response
      supabase.from("order_disputes").select("id", { count: "exact", head: true }).eq("seller_id", user.id).eq("status", "seller_notified"),
      // Buyer: disputes where the seller has responded and buyer should review
      supabase.from("order_disputes").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("status", "seller_responded"),
      // Buyer: auction orders where auto-charge failed and manual payment is needed
      supabase.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id).eq("status", "pending").not("payment_deadline_at", "is", null).gt("payment_deadline_at", new Date().toISOString()),
      // Pending trade proposals received by this user
      supabase.from("trade_offers").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).eq("status", "pending"),
    ]);
    profile = data;
    unreadMessages = msgCount ?? 0;
    pendingSalesOrders = salesCount ?? 0;
    pendingBuyerPayments = buyerPendingCount ?? 0;
    actionableDisputeCount = (sellerDisputeCount ?? 0) + (buyerDisputeCount ?? 0);
    pendingTrades = tradeCount ?? 0;
    if (profile?.is_admin) {
      const { count } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "pending");
      pendingReports = count ?? 0;
    }
  }

  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable} antialiased`} suppressHydrationWarning>
      <body className="min-h-screen flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <CartProvider>
            <Navbar
              user={user}
              avatarUrl={profile?.avatar_url}
              username={profile?.username}
              isAdmin={profile?.is_admin ?? false}
              unreadMessages={unreadMessages}
              pendingReports={pendingReports}
              pendingSalesOrders={pendingSalesOrders}
              pendingBuyerPayments={pendingBuyerPayments}
              actionableDisputeCount={actionableDisputeCount}
              pendingTrades={pendingTrades}
            />
            <main className="flex-1">{children}</main>
            <Footer />
            <CartDrawer />
            <Toaster richColors />
            <Analytics />
            <PushNotificationProvider />
            {user && <SessionTracker />}
          </CartProvider>
        </ThemeProvider>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-DK3GZD3KHM" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-DK3GZD3KHM');
        `}</Script>
      </body>
    </html>
  );
}
