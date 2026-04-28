import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import Navbar from "@/components/layout/navbar";
import { ThemeProvider } from "@/components/theme-provider";
import { createClient } from "@/lib/supabase/server";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Plantet — Buy, Sell & Auction Plants",
  description:
    "A marketplace for nurseries and hobbyists to buy, sell, and auction plants.",
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
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, is_admin")
      .eq("id", user.id)
      .single();
    profile = data;
  }

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ThemeProvider>
          <div className="w-full bg-yellow-400 text-yellow-900 text-center text-sm font-medium py-2 px-4">
            🚧 Plantet is currently in development — payments are not active yet. Stay tuned!
          </div>
          <Navbar
            user={user}
            avatarUrl={profile?.avatar_url}
            username={profile?.username}
            isAdmin={profile?.is_admin ?? false}
          />
          <main className="flex-1">{children}</main>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
