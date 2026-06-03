import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: "🌱",
    title: "My Garden",
    description: "Track every plant you own — log care events, monitor health, and share your collection publicly with followers. Your garden lives on your storefront.",
    href: "/garden",
    cta: "Start your garden",
  },
  {
    icon: "🤝",
    title: "Community",
    description: "Ask for plant ID help, share a proud grow moment, or start a discussion. Connect with other growers who love plants as much as you do.",
    href: "/community",
    cta: "Visit the community",
  },
  {
    icon: "🛒",
    title: "Buy & Discover",
    description: "Browse thousands of plants from independent growers. Filter by size, category, and location. Save favorites to your wishlist and follow sellers you love.",
    href: "/shop",
    cta: "Browse the shop",
  },
  {
    icon: "🏷️",
    title: "Sell & Auction",
    description: "Open your own storefront, list plants at a fixed price, or run timed auctions. Buyers bid in real time and get charged automatically when you win.",
    href: "/dashboard",
    cta: "Set up your shop",
  },
];

export default async function WelcomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .single();

  const name = profile?.display_name || profile?.username || "there";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-16">
      <div className="max-w-3xl w-full space-y-10">

        {/* Header */}
        <div className="text-center space-y-3">
          <p className="text-4xl">🌿</p>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Welcome to Plantet, {name}!
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Here&apos;s everything you can do. Explore at your own pace — your dashboard will guide you when you&apos;re ready to set up your shop.
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map(({ icon, title, description, href, cta }) => (
            <Link
              key={title}
              href={href}
              className="group rounded-2xl border bg-card p-6 hover:shadow-md hover:border-leaf/40 transition-all space-y-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{icon}</span>
                <h2 className="text-lg font-semibold group-hover:text-leaf transition-colors">{title}</h2>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
              <p className="text-sm font-medium text-leaf">{cta} →</p>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }), "bg-leaf hover:bg-forest px-10")}>
            Get started →
          </Link>
          <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "lg" }))}>
            Browse plants first
          </Link>
        </div>

      </div>
    </div>
  );
}
