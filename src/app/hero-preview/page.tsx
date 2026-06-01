import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const heroBg = "linear-gradient(160deg, #235140, #19392B)";

// Shared left-side copy (same for all three)
function HeroLeft() {
  return (
    <div className="text-center lg:text-left">
      <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
        Built for plant people
      </span>
      <h1
        className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-[-0.02em]"
        style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
      >
        Your plants.<br />Your people.<br />Your garden.
      </h1>
      <p className="text-base sm:text-lg text-white/70 mb-8 max-w-lg mx-auto lg:mx-0">
        Track every plant you own, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
        <Link
          href="/signup"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-terra text-white hover:bg-[#B05A39] font-semibold px-8 text-base flex flex-col items-center gap-0 h-auto py-3 border-0"
          )}
        >
          <span className="text-[11px] font-normal text-white/70 leading-none mb-1">Free to join</span>
          Start your garden log
        </Link>
        <Link
          href="/shop"
          className={cn(
            buttonVariants({ size: "lg" }),
            "bg-transparent text-cream border border-cream/50 hover:bg-cream/10 font-semibold px-8 text-base"
          )}
        >
          Browse the shop
        </Link>
      </div>
      <p className="text-xs text-white/40 text-center lg:text-left">
        <Link href="/auctions" className="hover:text-white/70 transition-colors">browse live auctions</Link>
        {" · "}
        <Link href="/community" className="hover:text-white/70 transition-colors">explore the community →</Link>
      </p>
    </div>
  );
}

export default async function HeroPreviewPage() {
  // Fetch real counts for Option B
  const supabase = await createClient();
  const [
    { count: plantCount },
    { count: postCount },
    { count: auctionCount },
    { count: userCount },
  ] = await Promise.all([
    supabase.from("garden_plants").select("id", { count: "exact", head: true }),
    supabase.from("community_posts").select("id", { count: "exact", head: true }),
    supabase.from("auctions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  return (
    <div className="bg-background">

      {/* ── Sticky nav ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-background/95 border-b backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">Hero Preview — Right Side Options</p>
            <p className="text-xs text-muted-foreground">All use the same left copy + buttons. Pick the right side you like.</p>
          </div>
          <div className="flex gap-2 text-xs">
            <a href="#option-a" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">A · Cards</a>
            <a href="#option-b" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">B · Stats</a>
            <a href="#option-c" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">C · Features</a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION A — Garden log card mockups
          Shows what the actual product looks like — 3 plant cards
          styled as real UI. No user photos, just product preview.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-a">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-terra text-white">Option A</span>
            <p className="text-sm font-semibold">Garden log card mockups</p>
            <p className="text-sm text-muted-foreground">— Shows the actual product UI; sells the garden log feature directly</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />

              {/* Right: plant card mockups */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full relative h-80 lg:h-96">

                {/* Card 3 — back */}
                <div className="absolute top-8 right-0 w-56 rounded-2xl overflow-hidden bg-white/10 border border-white/20 backdrop-blur-sm shadow-xl"
                  style={{ transform: "rotate(6deg)", transformOrigin: "bottom right", opacity: 0.6 }}>
                  <div className="h-24 flex items-center justify-center text-5xl" style={{ background: "#3D6B47" }}>🌵</div>
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm leading-tight">Euphorbia trigona</p>
                    <p className="text-white/50 text-xs">African Milk Tree</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full">🌵 Thriving</span>
                    </div>
                  </div>
                </div>

                {/* Card 2 — middle */}
                <div className="absolute top-4 left-8 w-56 rounded-2xl overflow-hidden bg-white/10 border border-white/20 backdrop-blur-sm shadow-xl"
                  style={{ transform: "rotate(-4deg)", transformOrigin: "bottom left", opacity: 0.75 }}>
                  <div className="h-24 flex items-center justify-center text-5xl" style={{ background: "#6B3F5E" }}>🌸</div>
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm leading-tight">Philodendron</p>
                    <p className="text-white/50 text-xs">Pink Princess</p>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <span className="text-[10px] bg-blue-400/30 text-blue-200 px-2 py-0.5 rounded-full">💧 Water in 2d</span>
                    </div>
                  </div>
                </div>

                {/* Card 1 — front */}
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-64 rounded-2xl overflow-hidden bg-white/15 border border-white/30 backdrop-blur-sm shadow-2xl">
                  <div className="h-28 flex items-center justify-center text-6xl" style={{ background: "#2D5A3D" }}>🌿</div>
                  <div className="p-4">
                    <p className="text-white font-bold text-sm leading-tight">Monstera deliciosa</p>
                    <p className="text-white/60 text-xs mb-3">Thai Constellation · 6&quot; pot</p>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      <span className="text-[10px] bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">✅ Thriving</span>
                      <span className="text-[10px] bg-blue-400/20 text-blue-300 px-2 py-0.5 rounded-full">💧 Watered today</span>
                      <span className="text-[10px] bg-amber-400/20 text-amber-300 px-2 py-0.5 rounded-full">🌱 Fertilize in 5d</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-2">
                      <p className="text-white/40 text-[10px]">Added Jun 1 · @mason</p>
                      <p className="text-white/40 text-[10px]">12 events logged</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION B — Live platform stats
          Real numbers pulled from your DB. Feels alive and builds
          social proof without any user photo privacy concerns.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-b">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-terra text-white">Option B</span>
            <p className="text-sm font-semibold">Live platform stats</p>
            <p className="text-sm text-muted-foreground">— Real numbers from your DB; builds social proof, updates automatically as you grow</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />

              {/* Right: stats card */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full space-y-3">

                {/* Main stat card */}
                <div className="rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/15 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">What&apos;s growing on Plantet</p>
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  </div>
                  <div className="grid grid-cols-2 divide-x divide-y divide-white/10">
                    {[
                      { value: plantCount ?? 0,   label: "plants tracked",      icon: "🪴" },
                      { value: userCount ?? 0,    label: "plant lovers joined",  icon: "👥" },
                      { value: postCount ?? 0,    label: "community posts",      icon: "💬" },
                      { value: auctionCount ?? 0, label: "live auctions now",    icon: "⚡" },
                    ].map((stat) => (
                      <div key={stat.label} className="px-5 py-4 flex flex-col gap-1">
                        <span className="text-lg">{stat.icon}</span>
                        <p className="text-2xl font-bold text-white tabular-nums">
                          {stat.value.toLocaleString()}
                        </p>
                        <p className="text-xs text-white/50 leading-tight">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Secondary trust line */}
                <div className="flex items-center gap-3 px-1">
                  <div className="flex -space-x-2">
                    {["#2D6A4F", "#6B3F5E", "#8B5E3C", "#1B5E3B"].map((color, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-[#235140] flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>
                        {["M", "J", "R", "S"][i]}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/50">
                    Join plant lovers already tracking their collections
                  </p>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION C — Floating feature cards
          Three clickable lanes for the three pillars. Every visitor
          finds their reason instantly. No user content at all.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-c">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-terra text-white">Option C</span>
            <p className="text-sm font-semibold">Feature lane cards</p>
            <p className="text-sm text-muted-foreground">— Shows all three pillars at a glance; every visitor finds their reason in one look</p>
          </div>
        </div>

        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />

              {/* Right: feature lanes */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full space-y-3">
                {[
                  {
                    emoji: "🪴",
                    bg: "bg-[#2D6A4F]/50",
                    border: "border-[#52B788]/30",
                    accent: "text-[#95D5B2]",
                    glow: "hover:border-[#52B788]/60",
                    title: "Grow",
                    tagline: "Your personal plant journal",
                    desc: "Track every plant, log care events, set reminders, watch your collection grow over time.",
                    cta: "Start your garden log →",
                    href: "/garden",
                    badge: "Free forever",
                    badgeColor: "bg-[#52B788]/20 text-[#95D5B2]",
                  },
                  {
                    emoji: "💬",
                    bg: "bg-[#1B4332]/50",
                    border: "border-white/20",
                    accent: "text-white/80",
                    glow: "hover:border-white/40",
                    title: "Connect",
                    tagline: "The plant community",
                    desc: "Ask for help, show off your collection, follow growers you love, and get their updates in your feed.",
                    cta: "Explore the community →",
                    href: "/community",
                    badge: "New posts daily",
                    badgeColor: "bg-white/10 text-white/60",
                  },
                  {
                    emoji: "🛒",
                    bg: "bg-[#774936]/40",
                    border: "border-[#C77B4A]/30",
                    accent: "text-[#E9C46A]",
                    glow: "hover:border-[#C77B4A]/60",
                    title: "Sell",
                    tagline: "Your plants, your price",
                    desc: "List at a fixed price or run timed auctions. Payments go straight to your bank via Stripe.",
                    cta: "Start selling free →",
                    href: "/signup",
                    badge: "No listing fees",
                    badgeColor: "bg-[#C77B4A]/20 text-[#E9C46A]",
                  },
                ].map((lane) => (
                  <Link
                    key={lane.title}
                    href={lane.href}
                    className={`flex items-start gap-4 rounded-xl border px-5 py-4 ${lane.bg} ${lane.border} ${lane.glow} backdrop-blur-sm transition-all hover:bg-white/10 group`}
                  >
                    <span className="text-3xl shrink-0 mt-0.5">{lane.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-bold text-white text-sm">{lane.title}</p>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${lane.badgeColor}`}>{lane.badge}</span>
                      </div>
                      <p className={`text-xs font-medium mb-1 ${lane.accent}`}>{lane.tagline}</p>
                      <p className="text-white/50 text-xs leading-relaxed">{lane.desc}</p>
                    </div>
                    <span className={`text-xs font-semibold shrink-0 mt-1 ${lane.accent} opacity-0 group-hover:opacity-100 transition-opacity`}>→</span>
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
          Visit <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/hero-preview</code> — nothing is live until you pick one.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Option B stats are pulled live from your real Supabase data right now.
        </p>
      </div>

    </div>
  );
}
