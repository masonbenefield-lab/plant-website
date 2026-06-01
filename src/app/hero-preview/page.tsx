import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Placeholder data ──────────────────────────────────────────────────────
const gardenMosaic = [
  { name: "Monstera deliciosa", user: "plantlady_tx",   bg: "#2D5A3D", emoji: "🌿" },
  { name: "Pink Princess",      user: "rare_roots",     bg: "#6B3F5E", emoji: "🌸" },
  { name: "Pilea peperomioides",user: "green.thumb",    bg: "#4A7C59", emoji: "🪴" },
  { name: "Alocasia Polly",     user: "tropicalhaus",   bg: "#1B5E3B", emoji: "🌱" },
  { name: "Hoya kerrii",        user: "hoya.hunter",    bg: "#8B5E3C", emoji: "💚" },
  { name: "Variegated Pothos",  user: "variegated.co",  bg: "#3D6B47", emoji: "🍃" },
];

const feedItems = [
  { type: "show_and_tell", label: "Show & Tell", labelColor: "bg-[#DFE7D4] text-leaf",   text: "My Monstera Thai Constellation just pushed a new leaf!",  user: "tropicalhaus",  time: "2m ago" },
  { type: "help",          label: "Help",        labelColor: "bg-amber-100 text-amber-700", text: "Why are my Calathea leaves curling? Any ideas?",           user: "plantlady_tx",  time: "11m ago" },
  { type: "sale",          label: "New Listing", labelColor: "bg-blue-100 text-blue-700",  text: "Just listed: 6\" Alocasia Silver Dragon — $38",            user: "rare_roots",    time: "18m ago" },
  { type: "garden",        label: "Garden",      labelColor: "bg-purple-100 text-purple-700", text: "Added 4 new plants to my collection this week",         user: "green.thumb",   time: "34m ago" },
  { type: "show_and_tell", label: "Show & Tell", labelColor: "bg-[#DFE7D4] text-leaf",   text: "Before/after: my Hoya kerrii after 6 months of care 🌱",    user: "hoya.hunter",   time: "1h ago" },
];

// ─── Shared gradient bg ─────────────────────────────────────────────────────
const heroBg = "linear-gradient(160deg, #235140, #19392B)";

export default function HeroPreviewPage() {
  return (
    <div className="bg-background">

      {/* ── Page header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-background/95 border-b backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Hero Preview</p>
            <p className="text-xs text-muted-foreground">3 options — none are live. Pick one and we&apos;ll swap it in.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="#option-1" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">Option 1</a>
            <a href="#option-2" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">Option 2</a>
            <a href="#option-3" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">Option 3</a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION 1 — Garden log first
          Lead with the garden log. Selling is a feature, not the identity.
          Right side: photo mosaic from the community.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-1">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-leaf text-white">Option 1</span>
            <p className="text-sm font-semibold">Garden-log first</p>
            <p className="text-sm text-muted-foreground">— Lead with collection + community; selling is a benefit, not the headline</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left */}
              <div className="text-center lg:text-left">
                <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
                  Built for plant people
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-[-0.02em]" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
                  Your plants.<br />Your people.<br />Your garden.
                </h1>
                <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0">
                  Track every plant you own, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-leaf hover:bg-forest text-white font-semibold px-8 text-base border-0")}>
                    🪴 Start your garden log
                  </Link>
                  <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "bg-transparent text-white border border-white/50 hover:bg-white/10 font-semibold px-8 text-base")}>
                    Browse the shop
                  </Link>
                </div>
                <p className="text-xs text-white/40 text-center lg:text-left">
                  <Link href="/auctions" className="hover:text-white/70 transition-colors">browse live auctions</Link>
                  {" · "}
                  <Link href="/community" className="hover:text-white/70 transition-colors">explore the community →</Link>
                </p>
              </div>

              {/* Right: garden photo mosaic */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full">
                <div className="grid grid-cols-3 gap-2">
                  {gardenMosaic.map((plant, i) => (
                    <div
                      key={i}
                      className="relative rounded-xl overflow-hidden aspect-square flex items-center justify-center"
                      style={{ backgroundColor: plant.bg }}
                    >
                      <span className="text-4xl">{plant.emoji}</span>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2">
                        <p className="text-white text-[10px] font-semibold leading-tight truncate">{plant.name}</p>
                        <p className="text-white/60 text-[9px] truncate">@{plant.user}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-center text-white/40 text-xs mt-3">From real gardens on Plantet</p>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION 2 — Community first
          Lead with the living community. Right side: activity feed.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-2">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-leaf text-white">Option 2</span>
            <p className="text-sm font-semibold">Community first</p>
            <p className="text-sm text-muted-foreground">— Lead with the living community; right side shows real-time activity to prove it&apos;s alive</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left */}
              <div className="text-center lg:text-left">
                <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
                  More than a marketplace
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-[-0.02em]" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
                  Where plant<br className="hidden sm:block" /> people grow<br className="hidden sm:block" /> together.
                </h1>
                <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0">
                  Share your collection, ask for help, discover rare finds, and sell your extras — the whole plant hobby, in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-leaf hover:bg-forest text-white font-semibold px-8 text-base border-0")}>
                    Join the community
                  </Link>
                  <Link href="/community" className={cn(buttonVariants({ size: "lg" }), "bg-transparent text-white border border-white/50 hover:bg-white/10 font-semibold px-8 text-base")}>
                    Explore the feed →
                  </Link>
                </div>
                <p className="text-xs text-white/40 text-center lg:text-left">
                  <Link href="/shop" className="hover:text-white/70 transition-colors">browse the shop</Link>
                  {" · "}
                  <Link href="/auctions" className="hover:text-white/70 transition-colors">live auctions →</Link>
                </p>
              </div>

              {/* Right: live activity feed */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full">
                <div className="rounded-2xl overflow-hidden bg-white/10 backdrop-blur-sm border border-white/20">
                  <div className="px-4 py-3 border-b border-white/20 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">What&apos;s happening</p>
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div className="divide-y divide-white/10">
                    {feedItems.map((item, i) => (
                      <div key={i} className="flex items-start gap-3 px-4 py-3">
                        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">
                          {item.user[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.labelColor}`}>{item.label}</span>
                            <span className="text-white/50 text-[10px]">@{item.user}</span>
                          </div>
                          <p className="text-white/90 text-xs leading-relaxed line-clamp-2">{item.text}</p>
                        </div>
                        <span className="text-white/30 text-[10px] shrink-0 mt-1">{item.time}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-3 border-t border-white/20">
                    <Link href="/community" className="text-xs text-white/60 hover:text-white/90 transition-colors font-medium">
                      See everything in the community →
                    </Link>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION 3 — Three pillars
          All three identities visible at once. Right side: three lane cards.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-3">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-leaf text-white">Option 3</span>
            <p className="text-sm font-semibold">Three pillars</p>
            <p className="text-sm text-muted-foreground">— All three identities at a glance; one CTA per pillar so every visitor finds their reason</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

              {/* Left */}
              <div className="text-center lg:text-left">
                <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
                  All in one place
                </span>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-[-0.02em]" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
                  Grow.<br />Connect.<br />Sell.
                </h1>
                <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0">
                  Plantet is the only app built for every part of the plant hobby — your garden log, your community, and your storefront, all in one place.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
                  <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-terra hover:bg-[#B05A39] text-white font-semibold px-8 text-base border-0")}>
                    Get started free
                  </Link>
                  <Link href="/community" className={cn(buttonVariants({ size: "lg" }), "bg-transparent text-white border border-white/50 hover:bg-white/10 font-semibold px-8 text-base")}>
                    Explore Plantet
                  </Link>
                </div>
              </div>

              {/* Right: three lane cards */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full space-y-3">
                {[
                  {
                    emoji: "🪴",
                    color: "bg-[#2D6A4F]/60",
                    accent: "text-[#95D5B2]",
                    title: "Grow",
                    desc: "Track every plant you own — photos, care schedules, growth logs, and origin history.",
                    cta: "Start your garden log →",
                    href: "/garden",
                  },
                  {
                    emoji: "💬",
                    color: "bg-[#1B4332]/60",
                    accent: "text-[#74C69D]",
                    title: "Connect",
                    desc: "Ask for help, show off your collection, follow growers, and browse your community feed.",
                    cta: "Explore the community →",
                    href: "/community",
                  },
                  {
                    emoji: "🛒",
                    color: "bg-[#774936]/60",
                    accent: "text-[#E9C46A]",
                    title: "Sell",
                    desc: "List plants at a fixed price or run live timed auctions. Get paid directly via Stripe.",
                    cta: "Start selling free →",
                    href: "/signup",
                  },
                ].map((lane) => (
                  <Link
                    key={lane.title}
                    href={lane.href}
                    className={`flex items-center gap-4 rounded-xl border border-white/20 px-5 py-4 ${lane.color} backdrop-blur-sm hover:border-white/40 transition-colors group`}
                  >
                    <span className="text-3xl shrink-0">{lane.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-base mb-0.5">{lane.title}</p>
                      <p className="text-white/60 text-xs leading-relaxed">{lane.desc}</p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 ${lane.accent} group-hover:underline`}>{lane.cta}</span>
                  </Link>
                ))}
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* ── Footer note ──────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          This page is only visible to you at <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/hero-preview</code> — nothing is live until you choose one.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Real garden photos and community activity will populate from your actual Supabase data when we swap it in.
        </p>
      </div>

    </div>
  );
}
