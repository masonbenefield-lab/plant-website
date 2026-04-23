import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";

const fallbackListings = [
  { emoji: "🌿", name: "Monstera Deliciosa", price: "$24", tag: "In Shop", bg: "bg-green-100",   href: "/shop" },
  { emoji: "🌸", name: "Pink Princess",      price: "$85", tag: "Auction", bg: "bg-pink-100",    href: "/auctions" },
  { emoji: "🌵", name: "Blue Torch Cactus",  price: "$18", tag: "In Shop", bg: "bg-amber-100",   href: "/shop" },
  { emoji: "🪴", name: "Golden Pothos",       price: "$12", tag: "In Shop", bg: "bg-emerald-100", href: "/shop" },
];

const features = [
  { icon: "🌿", title: "Build Your Storefront",   desc: "Create a personal shop page with your bio, profile photo, and all your listings in one place." },
  { icon: "🛒", title: "Sell at Fixed Price",      desc: "List plants with photos, variety details, and inventory count. Buyers purchase instantly." },
  { icon: "⚡", title: "Run Live Auctions",        desc: "Set a starting bid and end time. Watch live bids roll in — highest bidder wins when the clock hits zero." },
  { icon: "📦", title: "Seamless Fulfillment",     desc: "Buyer shipping addresses land straight in your seller dashboard so you always know what to ship and where." },
  { icon: "💳", title: "Secure Payments",          desc: "Powered by Stripe. Buyers pay on-site; funds route directly to your bank minus a small platform fee." },
  { icon: "⭐", title: "Trusted Reviews",          desc: "Buyers rate sellers after delivery, building reputation that helps great nurseries stand out." },
];

const audiences = [
  { emoji: "🏡", label: "Small Nurseries",      desc: "Move seasonal inventory and reach buyers beyond your local area." },
  { emoji: "🔍", label: "Hobbyist Collectors",  desc: "Trade rare finds, offsets, and propagations with fellow enthusiasts." },
  { emoji: "🏆", label: "Rare Plant Sellers",   desc: "Run time-limited auctions to get true market value for sought-after specimens." },
];

const testimonials = [
  {
    initials: "SM", name: "Sarah M.", role: "Small Nursery Owner",
    quote: "I moved 40 plants in my first month. The auction feature is a game changer for rare cuttings — I got way more than I ever would have priced them at.",
  },
  {
    initials: "JT", name: "James T.", role: "Rare Plant Collector",
    quote: "Finally a place built for plant people. I've found varieties here I couldn't get anywhere else, and every seller has been fantastic to deal with.",
  },
  {
    initials: "RK", name: "Rosa K.", role: "Hobbyist Seller",
    quote: "Setting up my storefront took 10 minutes. I listed my extra propagations and sold out within a week. The shipping dashboard makes fulfillment so easy.",
  },
];

const steps = [
  { step: "1", title: "Create your account",  desc: "Sign up free and build your seller profile in minutes." },
  { step: "2", title: "Connect your bank",    desc: "Link your bank account so payments go straight to you." },
  { step: "3", title: "List your plants",     desc: "Add fixed-price listings or kick off a timed auction." },
];

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: liveListings } = await supabase
    .from("listings")
    .select("id, plant_name, variety, price_cents, images")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(4);

  const bgCycle = ["bg-green-100", "bg-pink-100", "bg-amber-100", "bg-emerald-100"];
  const emojiCycle = ["🌿", "🌸", "🌵", "🪴"];

  const heroCards = liveListings && liveListings.length >= 2
    ? liveListings.map((l, i) => ({
        id: l.id,
        name: l.plant_name + (l.variety ? ` ${l.variety}` : ""),
        price: centsToDisplay(l.price_cents),
        tag: "In Shop",
        bg: bgCycle[i % bgCycle.length],
        emoji: emojiCycle[i % emojiCycle.length],
        image: l.images?.[0] ?? null,
        href: `/shop/${l.id}`,
      }))
    : fallbackListings;

  return (
    <div className="flex flex-col">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-green-800 via-green-700 to-emerald-600 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: copy */}
            <div className="text-center lg:text-left">
              <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
                Built for plant people
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
                The marketplace<br className="hidden sm:block" /> for plant lovers
              </h1>
              <p className="text-base sm:text-lg text-green-100 mb-10 max-w-lg mx-auto lg:mx-0">
                Buy, sell, and auction plants directly with nurseries and hobbyists.
                Open your storefront in minutes — no monthly fees, just a small commission when you sell.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold px-8 text-base")}>
                  Start Selling Free
                </Link>
                <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "bg-white/20 text-white border border-white/40 hover:bg-white/30 font-semibold px-8 text-base")}>
                  Browse Plants
                </Link>
              </div>
            </div>

            {/* Right: live listing cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-sm mx-auto lg:max-w-none">
              {heroCards.map((l, i) => (
                <Link key={l.name} href={l.href} className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className={cn("relative flex items-center justify-center h-24 sm:h-28 overflow-hidden", "image" in l && l.image ? "" : l.bg)}>
                    {"image" in l && l.image ? (
                      <img src={l.image} alt={l.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-4xl sm:text-5xl">{l.emoji}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-gray-800 text-sm leading-tight truncate">{l.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-green-700 font-bold text-sm">{l.price}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", l.tag === "Auction" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700")}>
                        {l.tag}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ── Trust bar ─────────────────────────────────────────────── */}
      <section className="border-y bg-white py-5 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><span className="text-green-600 font-bold text-base">2,400+</span> plants listed</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-green-600 font-bold text-base">180+</span> active sellers</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-green-600 font-bold text-base">4.9★</span> avg seller rating</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-green-600 font-bold text-base">Free</span> to start selling</span>
          </div>
        </div>
      </section>

      {/* ── Who it's for ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-stone-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Who it&apos;s for</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Whether you&apos;re moving nursery stock or trading rare cuttings, PlantMarket was built for you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {audiences.map((a) => (
              <div key={a.label} className="bg-white rounded-2xl border border-green-100 p-6 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl mb-4 block">{a.emoji}</span>
                <p className="font-bold text-gray-900 mb-2">{a.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">One platform handles your storefront, payments, orders, and reputation — so you can focus on growing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border bg-white p-6 hover:border-green-300 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-green-50 flex items-center justify-center text-2xl mb-4 group-hover:bg-green-100 transition-colors">
                  {f.icon}
                </div>
                <p className="font-semibold text-gray-900 mb-1.5">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-green-700 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Sell in 3 steps</h2>
          <p className="text-green-100 mb-12 max-w-md mx-auto">Getting started takes less than 10 minutes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 relative">
            {/* Connecting line on desktop */}
            <div className="hidden sm:block absolute top-6 left-[calc(16.67%+1rem)] right-[calc(16.67%+1rem)] h-px bg-white/30" />
            {steps.map((s) => (
              <div key={s.step} className="flex flex-col items-center relative">
                <div className="w-12 h-12 rounded-full bg-white text-green-700 flex items-center justify-center text-xl font-bold mb-5 shadow-md z-10">
                  {s.step}
                </div>
                <p className="font-semibold text-white mb-1">{s.title}</p>
                <p className="text-sm text-green-100 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-stone-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Sellers love it</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Real stories from nurseries and hobbyists who&apos;ve found their plant community.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl border p-6 shadow-sm flex flex-col gap-4">
                {/* Stars */}
                <div className="flex gap-0.5 text-amber-400 text-sm">{"★★★★★"}</div>
                {/* Quote */}
                <p className="text-sm text-gray-700 leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                {/* Author */}
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-9 h-9 rounded-full bg-green-100 text-green-700 font-bold text-xs flex items-center justify-center shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────────────── */}
      <section className="py-20 px-4 bg-gradient-to-br from-green-800 to-emerald-600 text-white text-center">
        <div className="max-w-xl mx-auto">
          <span className="text-4xl mb-6 block">🌱</span>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to grow your plant business?</h2>
          <p className="text-green-100 mb-8 text-base sm:text-lg">
            Join hundreds of nurseries and hobbyists already buying and selling on PlantMarket.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold px-10 text-base")}>
              Create Free Account
            </Link>
            <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "border-white/60 text-white hover:bg-white/10 font-semibold px-10 text-base")}>
              Browse Plants
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="bg-white border-t py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-bold text-green-700 text-lg">PlantMarket</p>
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link href="/shop" className="hover:text-foreground transition-colors">Shop</Link>
            <Link href="/auctions" className="hover:text-foreground transition-colors">Auctions</Link>
            <Link href="/signup" className="hover:text-foreground transition-colors">Sell</Link>
            <Link href="/login" className="hover:text-foreground transition-colors">Sign in</Link>
          </nav>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} PlantMarket</p>
        </div>
      </footer>

    </div>
  );
}
