import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";
import { PLANT_CATEGORIES } from "@/lib/categories";
import HeroSearch from "@/components/hero-search";
import LiveAuctionCard from "@/components/live-auction-card";

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

  const [{ data: liveListings }, { data: liveAuctions }, { data: nurseryProfiles }] = await Promise.all([
    supabase
      .from("listings")
      .select("id, plant_name, variety, price_cents, images")
      .eq("status", "active")
      .or("category.neq.Hidden,category.is.null")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("auctions")
      .select("id, plant_name, variety, current_bid_cents, images, ends_at")
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .or("category.neq.Hidden,category.is.null")
      .order("ends_at", { ascending: true })
      .limit(4),
    supabase
      .from("profiles")
      .select("id")
      .eq("plan", "nursery"),
  ]);

  const nurserySellerIds = (nurseryProfiles ?? []).map((p) => p.id);
  let featuredListings: { id: string; plant_name: string; variety: string | null; price_cents: number; images: string[] }[] = [];
  if (nurserySellerIds.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select("id, plant_name, variety, price_cents, images")
      .eq("status", "active")
      .or("category.neq.Hidden,category.is.null")
      .in("seller_id", nurserySellerIds)
      .order("created_at", { ascending: false })
      .limit(4);
    featuredListings = data ?? [];
  }

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
              <p className="text-base sm:text-lg text-green-100 mb-8 max-w-lg mx-auto lg:mx-0">
                Buy, sell, and auction plants directly with nurseries and hobbyists.
                Open your storefront in minutes — no monthly fees, just a small commission when you sell.
              </p>

              {/* Dual CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold px-8 text-base flex flex-col items-center gap-0 h-auto py-3")}>
                  <span className="text-[11px] font-normal text-green-700/70 leading-none mb-1">For sellers</span>
                  Start Selling Free
                </Link>
                <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "bg-white/15 text-white border border-white/40 hover:bg-white/25 font-semibold px-8 text-base flex flex-col items-center gap-0 h-auto py-3")}>
                  <span className="text-[11px] font-normal text-green-100/70 leading-none mb-1">For buyers</span>
                  Browse Plants
                </Link>
              </div>

              {/* Hero search */}
              <HeroSearch />
            </div>

            {/* Right: live listing cards */}
            <div className="grid grid-cols-2 gap-3 sm:gap-4 max-w-sm mx-auto lg:max-w-none">
              {heroCards.map((l) => (
                <Link key={l.name} href={l.href} className="bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                  <div className={cn("relative flex items-center justify-center h-24 sm:h-28 overflow-hidden", "image" in l && l.image ? "" : l.bg)}>
                    {"image" in l && l.image ? (
                      <Image src={l.image as string} alt={l.name} fill className="object-cover" priority />
                    ) : (
                      <span className="text-4xl sm:text-5xl">{l.emoji}</span>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-card-foreground text-sm leading-tight truncate">{l.name}</p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-green-600 dark:text-green-400 font-bold text-sm">{l.price}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", l.tag === "Auction" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300")}>
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

      {/* ── Category quick-links ──────────────────────────────────── */}
      <section className="bg-background border-b py-5 px-4">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground text-center mb-3">Browse by category</p>
          <div className="flex flex-wrap justify-center gap-2">
            {PLANT_CATEGORIES.map((c) => (
              <Link
                key={c}
                href={`/shop?category=${encodeURIComponent(c)}`}
                className="inline-flex items-center px-3.5 py-1.5 rounded-full border text-sm font-medium hover:border-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                {c}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust bar ─────────────────────────────────────────────── */}
      <section className="border-b bg-muted/40 py-5 px-4">
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

      {/* ── Live auctions ─────────────────────────────────────────── */}
      {liveAuctions && liveAuctions.length > 0 && (
        <section className="py-14 sm:py-16 px-4 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">Live Auctions</h2>
                <p className="text-muted-foreground mt-1 text-sm">Bid now — these end soon.</p>
              </div>
              <Link href="/auctions" className="text-sm font-medium text-green-700 hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {liveAuctions.map((a) => (
                <LiveAuctionCard
                  key={a.id}
                  id={a.id}
                  plant_name={a.plant_name}
                  variety={a.variety}
                  current_bid_cents={a.current_bid_cents}
                  images={a.images as string[]}
                  ends_at={a.ends_at}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Featured sellers (Nursery plan) ──────────────────────── */}
      {featuredListings.length > 0 && (
        <section className="py-14 sm:py-16 px-4 bg-muted/40">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-2 py-0.5 rounded-full">Featured</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">From top nurseries</h2>
                <p className="text-muted-foreground mt-1 text-sm">Hand-picked from our highest-rated professional sellers.</p>
              </div>
              <Link href="/shop" className="text-sm font-medium text-green-700 hover:underline">
                Browse all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {featuredListings.map((l, i) => {
                const bg = ["bg-green-100", "bg-pink-100", "bg-amber-100", "bg-emerald-100"][i % 4];
                const emoji = ["🌿", "🌸", "🌵", "🪴"][i % 4];
                return (
                  <Link key={l.id} href={`/shop/${l.id}`} className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border">
                    <div className={cn("relative flex items-center justify-center h-24 sm:h-28 overflow-hidden", l.images?.[0] ? "" : bg)}>
                      {l.images?.[0] ? (
                        <Image src={l.images[0]} alt={l.plant_name} fill className="object-cover" />
                      ) : (
                        <span className="text-4xl sm:text-5xl">{emoji}</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-card-foreground text-sm leading-tight truncate">{l.plant_name}{l.variety ? ` ${l.variety}` : ""}</p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">{centsToDisplay(l.price_cents)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">⭐ Featured</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Who it's for ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Who it&apos;s for</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Whether you&apos;re moving nursery stock or trading rare cuttings, Plantet was built for you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {audiences.map((a) => (
              <div key={a.label} className="bg-card rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow">
                <span className="text-3xl mb-4 block">{a.emoji}</span>
                <p className="font-bold text-foreground mb-2">{a.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">One platform handles your storefront, payments, orders, and reputation — so you can focus on growing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title} className="group rounded-2xl border bg-card p-6 hover:border-green-300 hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center text-2xl mb-4 group-hover:bg-green-100 dark:group-hover:bg-green-900/50 transition-colors">
                  {f.icon}
                </div>
                <p className="font-semibold text-foreground mb-1.5">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Transparent pricing ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-muted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Simple, honest pricing</h2>
          <p className="text-muted-foreground mb-10 max-w-md mx-auto">
            No subscription. No listing fees. We only make money when you do.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-2xl border p-6 flex flex-col items-center">
              <p className="text-4xl font-bold text-green-700 mb-2">$0</p>
              <p className="font-semibold mb-2">To list</p>
              <p className="text-sm text-muted-foreground leading-relaxed">Post unlimited listings and auctions — completely free.</p>
            </div>
            <div className="bg-card rounded-2xl border-2 border-green-600 p-6 flex flex-col items-center shadow-md">
              <p className="text-4xl font-bold text-green-700 mb-2">3–6.5%</p>
              <p className="font-semibold mb-2">Per sale</p>
              <p className="text-sm text-muted-foreground leading-relaxed">A small fee taken only when a sale completes. Rate depends on your plan.</p>
            </div>
            <div className="bg-card rounded-2xl border p-6 flex flex-col items-center">
              <p className="text-4xl font-bold text-green-700 mb-2">$0</p>
              <p className="font-semibold mb-2">Monthly fee</p>
              <p className="text-sm text-muted-foreground leading-relaxed">No subscription, no hidden charges, no surprises.</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Payments processed securely by Stripe. Funds deposit directly to your bank account.
          </p>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-green-700 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Sell in 3 steps</h2>
          <p className="text-green-100 mb-12 max-w-md mx-auto">Getting started takes less than 10 minutes.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-4 relative">
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
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Sellers love it</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Real stories from nurseries and hobbyists who&apos;ve found their plant community.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5 text-amber-400 text-sm">{"★★★★★"}</div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-9 h-9 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 font-bold text-xs flex items-center justify-center shrink-0">
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
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
            Join hundreds of nurseries and hobbyists already buying and selling on Plantet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-white text-green-800 hover:bg-green-50 font-semibold px-10 text-base")}>
              Create Free Account
            </Link>
            <Link href="/shop" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "bg-transparent border-white/60 text-white hover:bg-white/10 font-semibold px-10 text-base")}>
              Browse Plants
            </Link>
          </div>
        </div>
      </section>


    </div>
  );
}
