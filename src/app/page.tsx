import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: "🌿",
    title: "Build Your Storefront",
    desc: "Create a personal shop page with your bio, profile photo, and all your listings in one place.",
  },
  {
    icon: "🛒",
    title: "Sell at Fixed Price",
    desc: "List plants with photos, variety details, and inventory count. Buyers purchase instantly.",
  },
  {
    icon: "⚡",
    title: "Run Live Auctions",
    desc: "Set a starting bid and end time. Watch live bids roll in — highest bidder wins when the clock hits zero.",
  },
  {
    icon: "📦",
    title: "Seamless Fulfillment",
    desc: "Buyer shipping addresses land straight in your seller dashboard so you always know exactly what to ship and where.",
  },
  {
    icon: "💳",
    title: "Secure Payments",
    desc: "Powered by Stripe. Buyers pay on-site; funds route directly to your bank account minus a small platform fee.",
  },
  {
    icon: "⭐",
    title: "Trusted Reviews",
    desc: "Buyers rate sellers after delivery, building reputation that helps great nurseries stand out.",
  },
];

const audiences = [
  { label: "Small Nurseries", desc: "Move seasonal inventory and reach buyers beyond your local area." },
  { label: "Hobbyist Collectors", desc: "Trade rare finds, offsets, and propagations with fellow enthusiasts." },
  { label: "Rare Plant Sellers", desc: "Run time-limited auctions to get true market value for sought-after specimens." },
];

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-green-700 to-green-900 text-white py-24 px-4 text-center overflow-hidden">
        <div className="absolute inset-0 opacity-10 text-[200px] flex items-center justify-center select-none pointer-events-none">
          🌿
        </div>
        <div className="relative max-w-3xl mx-auto">
          <Badge className="bg-white/20 text-white hover:bg-white/30 mb-6 text-sm px-4 py-1.5">
            Built for plant people
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-tight mb-6">
            The marketplace for<br className="hidden sm:block" /> plant lovers
          </h1>
          <p className="text-lg sm:text-xl text-green-100 max-w-2xl mx-auto mb-10">
            Buy, sell, and auction plants directly with fellow nurseries and hobbyists.
            Open your storefront in minutes — no monthly fees, just a small commission when you sell.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/signup"
              className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold text-base px-8")}
            >
              Start Selling Free
            </Link>
            <Link
              href="/shop"
              className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white text-white hover:bg-white/10 font-semibold text-base px-8")}
            >
              Browse Plants
            </Link>
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Who it&apos;s for</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {audiences.map((a) => (
              <Card key={a.label} className="border-green-100">
                <CardContent className="p-6">
                  <p className="font-bold text-green-700 mb-2">{a.label}</p>
                  <p className="text-sm text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-10">Everything you need</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <Card key={f.title} className="bg-white">
                <CardContent className="p-6">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <p className="font-semibold mb-1">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-10">Sell in 3 steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Create your account", desc: "Sign up free and build your seller profile." },
              { step: "2", title: "Connect Stripe", desc: "Link your bank account so payments go straight to you." },
              { step: "3", title: "List your plants", desc: "Add fixed-price listings or start a timed auction." },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-green-700 text-white flex items-center justify-center text-xl font-bold mb-4">
                  {s.step}
                </div>
                <p className="font-semibold mb-1">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-green-700 text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-3xl font-bold mb-4">Ready to grow your plant business?</h2>
          <p className="text-green-100 mb-8">
            Join nurseries and hobbyists already buying and selling on PlantMarket.
          </p>
          <Link
            href="/signup"
            className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold text-base px-10")}
          >
            Create Free Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t bg-white text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} PlantMarket. All rights reserved.</p>
      </footer>
    </div>
  );
}
