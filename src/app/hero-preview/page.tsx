import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";

const heroBg = "linear-gradient(160deg, #235140, #19392B)";

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function timeUntil(iso: string): string {
  const hrs = Math.floor((new Date(iso).getTime() - Date.now()) / 3600000);
  if (hrs < 1) return "ending soon";
  if (hrs < 24) return `ends in ${hrs}h`;
  return `ends in ${Math.floor(hrs / 24)}d`;
}

// Shared left copy + buttons — same for every option
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
  const supabase = await createClient();

  const [
    { count: plantCount },
    { count: postCount },
    { count: auctionCount },
    { count: userCount },
    { data: recentPosts },
    { data: endingSoon },
  ] = await Promise.all([
    supabase.from("garden_plants").select("id", { count: "exact", head: true }),
    supabase.from("community_posts").select("id", { count: "exact", head: true }),
    supabase.from("auctions").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase
      .from("community_posts")
      .select("id, title, post_type, created_at")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("auctions")
      .select("id, plant_name, variety, current_bid_cents, ends_at")
      .eq("status", "active")
      .gt("ends_at", new Date().toISOString())
      .order("ends_at", { ascending: true })
      .limit(2),
  ]);

  return (
    <div className="bg-background">

      {/* ── Sticky nav ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-50 bg-white/95 dark:bg-background/95 border-b backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-bold text-sm">Hero Preview — Right Side Options</p>
            <p className="text-xs text-muted-foreground">Same left copy + buttons throughout. Pick a right side.</p>
          </div>
          <div className="flex gap-2 text-xs flex-wrap">
            <a href="#option-a" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">A · Card mockups</a>
            <a href="#option-b" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">B · Live counts</a>
            <a href="#option-c" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">C · Growth timeline</a>
            <a href="#option-d" className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 font-medium">D · Live activity</a>
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION A — Garden log card mockups (original)
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-a">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-terra text-white">Option A</span>
            <p className="text-sm font-semibold">Card mockups</p>
            <p className="text-sm text-muted-foreground">— Stacked plant cards styled to look like the app UI</p>
          </div>
        </div>
        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />
              <div className="max-w-sm mx-auto lg:max-w-none w-full relative h-80 lg:h-96">
                <div className="absolute top-8 right-0 w-56 rounded-2xl overflow-hidden bg-white/10 border border-white/20 backdrop-blur-sm shadow-xl"
                  style={{ transform: "rotate(6deg)", transformOrigin: "bottom right", opacity: 0.6 }}>
                  <div className="h-24 flex items-center justify-center text-5xl" style={{ background: "#3D6B47" }}>🌵</div>
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm leading-tight">Euphorbia trigona</p>
                    <p className="text-white/50 text-xs">African Milk Tree</p>
                    <div className="flex gap-1.5 mt-2"><span className="text-[10px] bg-white/15 text-white/80 px-2 py-0.5 rounded-full">🌵 Thriving</span></div>
                  </div>
                </div>
                <div className="absolute top-4 left-8 w-56 rounded-2xl overflow-hidden bg-white/10 border border-white/20 backdrop-blur-sm shadow-xl"
                  style={{ transform: "rotate(-4deg)", transformOrigin: "bottom left", opacity: 0.75 }}>
                  <div className="h-24 flex items-center justify-center text-5xl" style={{ background: "#6B3F5E" }}>🌸</div>
                  <div className="p-3">
                    <p className="text-white font-semibold text-sm leading-tight">Philodendron</p>
                    <p className="text-white/50 text-xs">Pink Princess</p>
                    <div className="flex gap-1.5 mt-2"><span className="text-[10px] bg-blue-400/30 text-blue-200 px-2 py-0.5 rounded-full">💧 Water in 2d</span></div>
                  </div>
                </div>
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
          OPTION B — Live platform counts (original)
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-b">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-terra text-white">Option B</span>
            <p className="text-sm font-semibold">Live counts</p>
            <p className="text-sm text-muted-foreground">— Real aggregate numbers from the DB; looks thin at launch, strong as you grow</p>
          </div>
        </div>
        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />
              <div className="max-w-sm mx-auto lg:max-w-none w-full space-y-3">
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
                      { value: plantCount ?? 0,   label: "plants tracked",     icon: "🪴" },
                      { value: userCount ?? 0,    label: "plant lovers joined", icon: "👥" },
                      { value: postCount ?? 0,    label: "community posts",     icon: "💬" },
                      { value: auctionCount ?? 0, label: "live auctions now",   icon: "⚡" },
                    ].map((stat) => (
                      <div key={stat.label} className="px-5 py-4 flex flex-col gap-1">
                        <span className="text-lg">{stat.icon}</span>
                        <p className="text-2xl font-bold text-white tabular-nums">{stat.value.toLocaleString()}</p>
                        <p className="text-xs text-white/50 leading-tight">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-3 px-1">
                  <div className="flex -space-x-2">
                    {["#2D6A4F", "#6B3F5E", "#8B5E3C", "#1B5E3B"].map((color, i) => (
                      <div key={i} className="w-7 h-7 rounded-full border-2 border-[#235140] flex items-center justify-center text-xs font-bold text-white" style={{ background: color }}>
                        {["M", "J", "R", "S"][i]}
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-white/50">Join plant lovers already tracking their collections</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION C — Growth timeline (new)
          Editorial/journal illustration of one plant's journey.
          Clearly illustrative — NOT a screenshot of the actual app.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-c">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-leaf text-white">Option C — New</span>
            <p className="text-sm font-semibold">Growth timeline</p>
            <p className="text-sm text-muted-foreground">— Editorial journal illustration of a plant&apos;s journey; shows the garden log story without mimicking the real UI</p>
          </div>
        </div>
        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />

              {/* Right: editorial plant journal */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full">
                <div className="rounded-2xl border border-white/20 overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>

                  {/* Header — big plant name, editorial style */}
                  <div className="px-6 pt-6 pb-4 border-b border-white/10" style={{ background: "rgba(45,90,61,0.6)" }}>
                    <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-1">Plant Journal · Entry #47</p>
                    <p className="text-white text-xl font-bold leading-tight">Monstera deliciosa</p>
                    <p className="text-white/60 text-sm italic">Thai Constellation · 6&quot; nursery pot</p>
                    <div className="flex gap-2 mt-3">
                      <span className="text-[10px] bg-green-400/20 text-green-300 font-semibold px-2.5 py-1 rounded-full">✅ Thriving</span>
                      <span className="text-[10px] bg-white/10 text-white/60 font-semibold px-2.5 py-1 rounded-full">Acquired from @rare_roots</span>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="px-6 py-5">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-4">Care history</p>
                    <div className="space-y-0">
                      {[
                        { dot: "bg-white/30",        line: true,  date: "Jun 1",  icon: "🪴", event: "Added to collection",        note: "4\" pot, 2 leaves, healthy roots" },
                        { dot: "bg-blue-400/70",      line: true,  date: "Jun 8",  icon: "💧", event: "Watered + first fertilize",   note: "Balanced liquid fertilizer" },
                        { dot: "bg-green-400",        line: true,  date: "Jun 15", icon: "🌿", event: "New leaf unfurling!",          note: "First variegated leaf — stunning" },
                        { dot: "bg-amber-400/70",     line: true,  date: "Jun 22", icon: "🪣", event: "Repotted to 6\"",             note: "Aroid mix, added perlite" },
                        { dot: "bg-white",            line: false, date: "Today",  icon: "✨", event: "Thriving · 3 new leaves",     note: "Next: fertilize in 5 days" },
                      ].map((item, i) => (
                        <div key={i} className="flex gap-3">
                          {/* Timeline spine */}
                          <div className="flex flex-col items-center w-4 shrink-0">
                            <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${item.dot}`} />
                            {item.line && <div className="w-px flex-1 bg-white/15 my-1" style={{ minHeight: "20px" }} />}
                          </div>
                          {/* Event content */}
                          <div className={`pb-4 ${!item.line ? "" : ""}`}>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-white/40 text-[10px] font-mono">{item.date}</span>
                              <span className="text-sm">{item.icon}</span>
                              <span className="text-white text-xs font-semibold">{item.event}</span>
                            </div>
                            <p className="text-white/40 text-[10px] leading-relaxed">{item.note}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
                    <p className="text-white/30 text-[10px]">Your garden log looks like this — but with your plants.</p>
                    <p className="text-white/30 text-[10px]">47 events logged</p>
                  </div>

                </div>
              </div>

            </div>
          </div>
        </section>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          OPTION D — Live activity feed (new)
          Real posts + auctions from the DB. No aggregate counts —
          activity proves the platform is alive regardless of size.
      ════════════════════════════════════════════════════════════════ */}
      <div id="option-d">
        <div className="max-w-5xl mx-auto px-4 pt-10 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-leaf text-white">Option D — New</span>
            <p className="text-sm font-semibold">Live activity feed</p>
            <p className="text-sm text-muted-foreground">— Real posts + auctions from your DB right now; activity proves life regardless of total size</p>
          </div>
        </div>
        <section className="text-white overflow-hidden" style={{ background: heroBg }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <HeroLeft />

              {/* Right: live activity */}
              <div className="max-w-sm mx-auto lg:max-w-none w-full space-y-3">

                <div className="rounded-2xl border border-white/20 overflow-hidden" style={{ background: "rgba(255,255,255,0.07)" }}>
                  <div className="px-5 py-3.5 border-b border-white/15 flex items-center justify-between">
                    <p className="text-sm font-semibold text-white">Happening right now</p>
                    <span className="flex items-center gap-1.5 text-xs text-white/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </span>
                  </div>

                  {/* Community posts */}
                  {(recentPosts ?? []).length > 0 && (
                    <div className="divide-y divide-white/10">
                      {(recentPosts ?? []).map((post) => {
                        const typeLabel =
                          post.post_type === "help" ? "Help" :
                          post.post_type === "show_and_tell" ? "Show & Tell" : "Discussion";
                        const typeColor =
                          post.post_type === "help" ? "bg-amber-400/20 text-amber-300" :
                          post.post_type === "show_and_tell" ? "bg-green-400/20 text-green-300" :
                          "bg-blue-400/20 text-blue-300";
                        return (
                          <div key={post.id} className="flex items-start gap-3 px-5 py-3">
                            <span className="text-base mt-0.5">💬</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
                              </div>
                              <p className="text-white/85 text-xs leading-snug line-clamp-1">{post.title}</p>
                            </div>
                            <span className="text-white/30 text-[10px] shrink-0 mt-1 tabular-nums">{timeAgo(post.created_at)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Auctions ending soon */}
                  {(endingSoon ?? []).length > 0 && (
                    <>
                      <div className="px-5 py-2 border-t border-white/10">
                        <p className="text-[10px] uppercase tracking-widest text-white/30 font-semibold">Auctions ending soon</p>
                      </div>
                      <div className="divide-y divide-white/10">
                        {(endingSoon ?? []).map((a) => (
                          <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                            <span className="text-base">⚡</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/85 text-xs font-medium line-clamp-1">
                                {a.plant_name}{a.variety ? ` ${a.variety}` : ""}
                              </p>
                              <p className="text-white/40 text-[10px]">
                                Current bid: ${((a.current_bid_cents ?? 0) / 100).toFixed(2)}
                              </p>
                            </div>
                            <span className="text-amber-300 text-[10px] font-semibold shrink-0 tabular-nums">{timeUntil(a.ends_at)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  {/* Fallback if no live data */}
                  {(recentPosts ?? []).length === 0 && (endingSoon ?? []).length === 0 && (
                    <div className="px-5 py-8 text-center">
                      <p className="text-white/40 text-sm">Live activity will appear here as people use the platform.</p>
                    </div>
                  )}

                  <div className="px-5 py-3 border-t border-white/10 flex items-center justify-between">
                    <Link href="/community" className="text-xs text-white/40 hover:text-white/70 transition-colors">See everything →</Link>
                    <Link href="/auctions" className="text-xs text-white/40 hover:text-white/70 transition-colors">All auctions →</Link>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-10 text-center space-y-1">
        <p className="text-sm text-muted-foreground">
          Visit <code className="text-xs bg-muted px-1.5 py-0.5 rounded">/hero-preview</code> — nothing is live until you pick one.
        </p>
        <p className="text-xs text-muted-foreground">B uses aggregate counts · D uses real live posts + auctions from your DB.</p>
      </div>

    </div>
  );
}
