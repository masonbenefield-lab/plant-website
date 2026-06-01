import Link from "next/link";
import Image from "next/image";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { centsToDisplay } from "@/lib/stripe";
import { GROUNDBREAKER_CAP } from "@/lib/plan-limits";
import HeroSearch from "@/components/hero-search";
import LiveAuctionCard from "@/components/live-auction-card";
import { HeroCategoryCarousel } from "@/components/hero-category-carousel";

const features = [
  { icon: "🌿", title: "Build Your Storefront",       desc: "Create a personal shop page with your bio, profile photo, and all your listings in one place.",    href: "/signup" },
  { icon: "🛒", title: "Sell at Fixed Price",          desc: "List plants with photos, variety details, and inventory count. Buyers purchase instantly.",          href: "/shop" },
  { icon: "⚡", title: "Run Live Auctions",            desc: "Set a starting bid and end time. Watch live bids roll in — highest bidder wins when the clock hits zero.", href: "/auctions" },
  { icon: "👥", title: "Follow Growers You Love",      desc: "Follow your favorite sellers and get their new listings, restocks, and updates straight in your feed.", href: "/shop" },
  { icon: "💳", title: "Secure Payments",              desc: "Powered by Stripe. Buyers pay on-site; funds route directly to your bank minus a small platform fee.", href: "/pricing" },
  { icon: "🪴", title: "Your Personal Garden Log",     desc: "Track every plant you own — care schedules, growth photos, source history, and event logs all in one place.", href: "/garden" },
];

const audiences = [
  { emoji: "🏡", label: "Small Nurseries",      desc: "Move seasonal inventory and reach buyers beyond your local area." },
  { emoji: "🔍", label: "Hobbyist Collectors",  desc: "Trade rare finds, offsets, and propagations with fellow enthusiasts." },
  { emoji: "🏆", label: "Rare Plant Sellers",   desc: "Run time-limited auctions to get true market value for sought-after specimens." },
  { emoji: "🌱", label: "Plant Enthusiasts",    desc: "Browse the shop, follow growers you love, ask the community for help, and track your own collection." },
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

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [{ data: liveAuctions }, { data: nurseryProfiles }, { count: groundbreakerCount }, { data: recentCommunityPosts }] = await Promise.all([
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
    supabase
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("groundbreaker", true),
    supabase
      .from("community_posts")
      .select("id, post_type, title, created_at")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  // ── Public garden showcase ──────────────────────────────────────────────
  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: activeGiveaway } = await admin
    .from("giveaway_months")
    .select("id")
    .eq("month", currentMonth)
    .maybeSingle();

  const { data: gardenShowcasePlants } = await admin
    .from("garden_plants")
    .select("id, name, variety, images, user_id")
    .eq("is_public", true)
    .filter("images", "neq", "{}")
    .order("created_at", { ascending: false })
    .limit(24);

  let gardenShowcase: { id: string; name: string; variety: string | null; image: string; username: string; displayName: string }[] = [];
  if (gardenShowcasePlants?.length) {
    const userIds = [...new Set(gardenShowcasePlants.map((p) => p.user_id))];
    const { data: gardenProfiles } = await admin
      .from("profiles")
      .select("id, username, display_name, garden_public")
      .in("id", userIds)
      .eq("garden_public", true);
    const publicUserMap = Object.fromEntries((gardenProfiles ?? []).map((p) => [p.id, p]));
    gardenShowcase = gardenShowcasePlants
      .filter((p) => publicUserMap[p.user_id] && (p.images as string[]).length > 0)
      .slice(0, 8)
      .map((p) => ({
        id: p.id,
        name: p.name,
        variety: p.variety ?? null,
        image: (p.images as string[])[0],
        username: publicUserMap[p.user_id].username,
        displayName: publicUserMap[p.user_id].display_name ?? publicUserMap[p.user_id].username,
      }));
  }

  const nurserySellerIds = (nurseryProfiles ?? []).map((p) => p.id);
  let featuredListings: { id: string; plant_name: string; variety: string | null; price_cents: number; sale_price_cents: number | null; sale_ends_at: string | null; images: string[] }[] = [];
  if (nurserySellerIds.length > 0) {
    const { data } = await supabase
      .from("listings")
      .select("id, plant_name, variety, price_cents, sale_price_cents, sale_ends_at, images")
      .eq("status", "active")
      .or("category.neq.Hidden,category.is.null")
      .in("seller_id", nurserySellerIds)
      .order("created_at", { ascending: false })
      .limit(4);
    featuredListings = data ?? [];
  }

  const groundbreakersLeft = GROUNDBREAKER_CAP - (groundbreakerCount ?? 0);

  return (
    <div className="flex flex-col">

      {/* ── Groundbreaker banner ─────────────────────────────────── */}
      {groundbreakersLeft > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 py-2.5 px-4 text-center text-sm text-amber-900 dark:text-amber-200">
          <span className="font-semibold">⛏️ Groundbreaker program:</span>{" "}
          {groundbreakersLeft} of {GROUNDBREAKER_CAP} spots remaining — the first {GROUNDBREAKER_CAP} sellers get the Nursery plan free forever + a permanent <strong>2% commission rate</strong>.{" "}
          <Link href="/signup" className="underline font-semibold hover:text-amber-700 dark:hover:text-amber-100">
            Claim your spot →
          </Link>
        </div>
      )}

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="text-white overflow-hidden" style={{ background: "linear-gradient(160deg, #235140, #19392B)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: copy */}
            <div className="text-center lg:text-left">
              <span className="inline-block bg-white/20 text-white text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6">
                Built for plant people
              </span>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6 tracking-[-0.02em]" style={{ fontFamily: "var(--font-bricolage), sans-serif" }}>
                The marketplace<br className="hidden sm:block" /> for plant lovers
              </h1>
              <p className="text-base sm:text-lg text-cream/80 mb-8 max-w-lg mx-auto lg:mx-0">
                Track your collection, connect with fellow growers, and buy or sell plants — all in one place.
              </p>

              {/* Dual CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-6">
                <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-terra text-white hover:bg-[#B05A39] font-semibold px-8 text-base flex flex-col items-center gap-0 h-auto py-3 border-0")}>
                  <span className="text-[11px] font-normal text-white/70 leading-none mb-1">For sellers</span>
                  Start Selling Free
                </Link>
                <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "bg-transparent text-cream border border-cream/50 hover:bg-cream/10 font-semibold px-8 text-base flex flex-col items-center gap-0 h-auto py-3")}>
                  <span className="text-[11px] font-normal text-cream/60 leading-none mb-1">For buyers</span>
                  Browse Plants
                </Link>
              </div>
              <p className="text-sm text-[#DFE7D4]/80 text-center lg:text-left">
                or{" "}
                <Link href="/auctions" className="font-medium text-white underline underline-offset-2 hover:text-[#C5D4BC]">
                  browse live auctions
                </Link>
                {" · "}
                <Link href="/garden" className="font-medium text-white underline underline-offset-2 hover:text-[#C5D4BC]">
                  start your garden log →
                </Link>
              </p>

              {/* Hero search */}
              <HeroSearch />
            </div>

            {/* Right: category carousel */}
            <div className="max-w-sm mx-auto lg:max-w-none w-full">
              <HeroCategoryCarousel hasActiveGiveaway={!!activeGiveaway} />
            </div>

          </div>
        </div>
      </section>


      {/* ── Trust bar ─────────────────────────────────────────────── */}
      <section className="border-b bg-[#DDD3BE] dark:bg-muted py-5 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><span className="text-leaf font-bold text-base">2,400+</span> plants listed</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-leaf font-bold text-base">180+</span> active sellers</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-leaf font-bold text-base">4.9★</span> avg seller rating</span>
            <span className="hidden sm:block text-border">·</span>
            <span className="flex items-center gap-2"><span className="text-leaf font-bold text-base">Free</span> to start selling</span>
          </div>
        </div>
      </section>

      {/* ── Garden log feature spotlight ──────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-[#EBF0E6] dark:bg-forest/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-[#DFE7D4] dark:bg-forest/40 text-leaf dark:text-sage text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              Free for everyone
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">Your personal plant journal</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Log every plant you own, track care events, and watch your collection grow over time. No purchase needed — just sign up and start adding plants.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            {[
              { icon: "📸", title: "Photo journal",     desc: "Add photos over time and watch your plants grow. Multiple images per plant." },
              { icon: "🗓️", title: "Care schedule",     desc: "Set intervals for watering, fertilizing, repotting, and pruning." },
              { icon: "📋", title: "Event log",         desc: "Record every care event with notes. Build a full history for each plant." },
              { icon: "🌍", title: "Share your garden", desc: "Make your garden public and share the link. Others can browse your collection." },
              { icon: "💚", title: "Wishlist",          desc: "Build a list of plants you're hunting for and share it with friends." },
              { icon: "✅", title: "Verified origins",  desc: "Tag where a plant came from — if it's a Plantet seller, they can verify it publicly." },
            ].map((f) => (
              <div key={f.title} className="bg-card rounded-2xl border p-5 shadow-sm">
                <span className="text-2xl mb-3 block">{f.icon}</span>
                <p className="font-semibold mb-1">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-leaf hover:bg-forest text-white font-semibold px-10")}>
              Start your garden log — it&apos;s free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Garden showcase ──────────────────────────────────────── */}
      {gardenShowcase.length > 0 && (
        <section className="py-16 sm:py-20 px-4 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-leaf bg-[#DFE7D4] px-3 py-1 rounded-full mb-3">From the community</span>
              <h2 className="text-2xl sm:text-3xl font-bold">See what people are growing</h2>
              <p className="text-muted-foreground mt-2 max-w-md mx-auto text-sm">Plant lovers keeping a digital garden log — photos, care notes, and growth over time.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {gardenShowcase.map((plant) => (
                <Link key={plant.id} href={`/gardens/${plant.username}`} className="group relative aspect-square rounded-xl overflow-hidden bg-muted">
                  <Image
                    src={plant.image}
                    alt={plant.name}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="(max-width: 640px) 50vw, 25vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-white text-sm font-semibold leading-tight truncate">{plant.name}</p>
                    <p className="text-white/70 text-xs truncate">by {plant.displayName}</p>
                  </div>
                </Link>
              ))}
            </div>
            <div className="text-center mt-8">
              <Link href="/garden" className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                🪴 Start your own garden log
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── Live auctions ─────────────────────────────────────────── */}
      {liveAuctions && liveAuctions.length > 0 && (
        <section className="py-14 sm:py-16 px-4 bg-background">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold">Live Auctions</h2>
                <p className="text-muted-foreground mt-1 text-sm">Bid now — these end soon.</p>
              </div>
              <Link href="/auctions" className="text-sm font-medium text-leaf hover:underline">
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
        <section className="py-14 sm:py-16 px-4 bg-[#DDD3BE] dark:bg-muted">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold uppercase tracking-widest text-leaf bg-[#DFE7D4] dark:bg-forest/40 dark:text-sage px-2 py-0.5 rounded-full">Featured</span>
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold">From top nurseries</h2>
                <p className="text-muted-foreground mt-1 text-sm">Hand-picked from our highest-rated professional sellers.</p>
              </div>
              <Link href="/shop" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Browse all →
              </Link>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {featuredListings.map((l, i) => {
                const bg = ["bg-[#DFE7D4]", "bg-pink-100", "bg-amber-100", "bg-emerald-100"][i % 4];
                const emoji = ["🌿", "🌸", "🌵", "🪴"][i % 4];
                const featOnSale = !!(l.sale_price_cents && l.sale_ends_at && new Date(l.sale_ends_at) > new Date());
                return (
                  <Link key={l.id} href={`/shop/${l.id}`} className="bg-card rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border">
                    <div className={cn("relative flex items-center justify-center h-24 sm:h-28 overflow-hidden", l.images?.[0] ? "" : bg)}>
                      {l.images?.[0] ? (
                        <Image src={l.images[0]} alt={l.plant_name} fill className="object-cover" />
                      ) : (
                        <span className="text-4xl sm:text-5xl">{emoji}</span>
                      )}
                      {featOnSale && (
                        <span className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">SALE</span>
                      )}
                    </div>
                    <div className="p-3">
                      <p className="font-semibold text-card-foreground text-sm leading-tight truncate">{l.plant_name}{l.variety ? ` ${l.variety}` : ""}</p>
                      <div className="flex items-center justify-between mt-1.5 gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-leaf dark:text-sage font-bold text-sm">{centsToDisplay(featOnSale ? l.sale_price_cents! : l.price_cents)}</span>
                          {featOnSale && (
                            <span className="text-muted-foreground text-xs line-through">{centsToDisplay(l.price_cents)}</span>
                          )}
                        </div>
                        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">⭐ Featured</span>
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
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Who it&apos;s for</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Whether you&apos;re moving nursery stock or trading rare cuttings, Plantet was built for you.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {audiences.map((a) => (
              <div key={a.label} className="bg-card rounded-2xl border p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl bg-[#EBF0E6] dark:bg-forest/30 flex items-center justify-center text-2xl mb-4">
                  {a.emoji}
                </div>
                <p className="font-bold text-foreground mb-2">{a.label}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{a.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-[#DDD3BE] dark:bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">One platform handles your storefront, payments, orders, and reputation — so you can focus on growing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <Link key={f.title} href={f.href} className="group rounded-2xl border bg-card p-6 hover:border-[#A8BF9A] hover:shadow-md transition-all">
                <div className="w-11 h-11 rounded-xl bg-[#EBF0E6] dark:bg-forest/30 flex items-center justify-center text-2xl mb-4 group-hover:bg-[#DFE7D4] dark:group-hover:bg-forest/50 transition-colors">
                  {f.icon}
                </div>
                <p className="font-semibold text-foreground mb-1.5">{f.title}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Community spotlight ──────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-[#EBF0E6] dark:bg-forest/20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span className="inline-block bg-[#DFE7D4] dark:bg-forest/40 text-leaf dark:text-sage text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-4">
              More than a marketplace
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold mb-3">A place for plant people</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Plantet is built around the people behind the plants — not just the transactions.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#EBF0E6] dark:bg-forest/30 flex items-center justify-center text-2xl">
                💬
              </div>
              <p className="font-bold text-foreground">Ask the Community</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Post a help request, share a plant you&apos;re proud of, or start a discussion. Fellow growers are here to help.
              </p>
              <Link href="/community" className="text-sm font-medium text-leaf hover:underline mt-auto">
                Browse community →
              </Link>
            </div>
            <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-[#EBF0E6] dark:bg-forest/30 flex items-center justify-center text-2xl">
                📣
              </div>
              <p className="font-bold text-foreground">Follow & Get Updates</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Follow sellers you love and get their new arrivals, restocks, and announcements straight in your personal feed.
              </p>
              <Link href="/shop" className="text-sm font-medium text-leaf hover:underline mt-auto">
                Find sellers to follow →
              </Link>
            </div>
            <div className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center text-2xl">
                🪴
              </div>
              <p className="font-bold text-foreground">Track Your Collection</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Log every plant you own, record care events, set watering reminders, and share your garden publicly with other enthusiasts.
              </p>
              <Link href="/signup" className="text-sm font-medium text-leaf hover:underline mt-auto">
                Start your garden log →
              </Link>
            </div>
          </div>

          {recentCommunityPosts && recentCommunityPosts.length > 0 && (
            <div className="mt-8 border rounded-2xl bg-card overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b flex items-center justify-between">
                <p className="text-sm font-semibold">Recent in the community</p>
                <Link href="/community" className="text-xs font-medium text-leaf hover:underline">See all →</Link>
              </div>
              {recentCommunityPosts.map((post) => {
                const typeColor = post.post_type === "help" ? "bg-amber-100 text-amber-700" : post.post_type === "show_and_tell" ? "bg-[#DFE7D4] text-leaf" : "bg-blue-100 text-blue-700";
                const typeLabel = post.post_type === "help" ? "Help" : post.post_type === "show_and_tell" ? "Show & Tell" : "Discussion";
                return (
                  <Link key={post.id} href={`/community/${post.id}`} className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/50 transition-colors border-b last:border-0">
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
                    <p className="text-sm font-medium line-clamp-1 text-foreground">{post.title}</p>
                    <span className="ml-auto text-xs text-muted-foreground shrink-0">
                      {new Date(post.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Transparent pricing ───────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-[#DDD3BE] dark:bg-muted">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Simple, honest pricing</h2>
          <p className="text-muted-foreground mb-10 max-w-md mx-auto">
            No listing fees. We only make money when you do.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-card rounded-2xl border p-6 flex flex-col items-center">
              <p className="text-4xl font-bold text-leaf mb-2">$0</p>
              <p className="font-semibold mb-2">To list</p>
              <p className="text-sm text-muted-foreground leading-relaxed">No listing fees — ever. Free plan includes 10 listings and 5 auctions. Unlimited on paid plans.</p>
            </div>
            <div className="bg-card rounded-2xl border-2 border-leaf p-6 flex flex-col items-center shadow-md">
              <p className="text-4xl font-bold text-leaf mb-2">3–6.5%</p>
              <p className="font-semibold mb-2">Per sale</p>
              <p className="text-sm text-muted-foreground leading-relaxed">A small fee taken only when a sale completes. Rate depends on your plan.</p>
            </div>
            <div className="bg-card rounded-2xl border p-6 flex flex-col items-center">
              <p className="text-4xl font-bold text-leaf mb-2">$0</p>
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
      <section className="py-16 sm:py-20 px-4 bg-background">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold mb-3 text-foreground">How it works</h2>
            <p className="text-muted-foreground max-w-md mx-auto">Simple for buyers. Simple for sellers.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-sm border">
              <p className="text-xs font-bold uppercase tracking-widest text-leaf mb-6">For Buyers</p>
              <div className="space-y-6">
                {([
                  { n: "1", title: "Browse the shop or auctions", desc: "Search by plant name, category, or price. Filter to in-stock only. Bid on live auctions in real time." },
                  { n: "2", title: "Add to cart and pay securely", desc: "Checkout is powered by Stripe. Your shipping address goes straight to the seller — no back-and-forth." },
                  { n: "3", title: "Track it in your garden log", desc: "Once it arrives, add it to My Garden. Log care events, set reminders, and share your collection." },
                ] as const).map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-forest text-cream flex items-center justify-center text-sm font-bold shrink-0">
                      {s.n}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-0.5">{s.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/shop" className="inline-block mt-7 text-sm font-medium text-leaf hover:text-forest dark:hover:text-sage underline underline-offset-2">
                Browse plants →
              </Link>
            </div>
            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-sm border">
              <p className="text-xs font-bold uppercase tracking-widest text-leaf mb-6">For Sellers</p>
              <div className="space-y-6">
                {([
                  { n: "1", title: "Connect your bank account", desc: "Sign up free and link your bank via Stripe. Takes under 10 minutes — no monthly fees, ever." },
                  { n: "2", title: "Add plants and set your price", desc: "Add inventory once, then list at a fixed price or kick off a timed auction from the same row." },
                  { n: "3", title: "Get paid when you sell", desc: "Funds deposit directly to your bank after each sale. Buyer's shipping address lands in your dashboard, ready to ship." },
                ] as const).map((s) => (
                  <div key={s.n} className="flex gap-4">
                    <div className="w-9 h-9 rounded-full bg-forest text-cream flex items-center justify-center text-sm font-bold shrink-0">
                      {s.n}
                    </div>
                    <div>
                      <p className="font-semibold text-foreground mb-0.5">{s.title}</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/signup" className="inline-block mt-7 text-sm font-medium text-leaf hover:text-forest dark:hover:text-sage underline underline-offset-2">
                Start selling free →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────── */}
      <section className="py-16 sm:py-20 px-4 bg-[#DDD3BE] dark:bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Sellers love it</h2>
          <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">Real stories from nurseries and hobbyists who&apos;ve found their plant community.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-card rounded-2xl border p-6 shadow-sm flex flex-col gap-4">
                <div className="flex gap-0.5 text-amber-400 text-sm">{"★★★★★"}</div>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-3 pt-2 border-t">
                  <div className="w-9 h-9 rounded-full bg-[#DFE7D4] dark:bg-forest/40 text-leaf dark:text-sage font-bold text-xs flex items-center justify-center shrink-0">
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
      <section className="py-20 px-4 text-white text-center" style={{ background: "linear-gradient(160deg, #235140, #19392B)" }}>
        <div className="max-w-xl mx-auto">
          <div className="flex justify-center mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="52" height="52">
              <g transform="translate(8 4)">
                <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" strokeWidth="6" strokeLinecap="round"/>
                <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
              </g>
            </svg>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to grow your plant business?</h2>
          <p className="text-cream/80 mb-8 text-base sm:text-lg">
            Join hundreds of nurseries and hobbyists already buying and selling on Plantet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "bg-terra text-white hover:bg-[#B05A39] font-semibold px-10 text-base border-0 min-w-[200px]")}>
              Create Free Account
            </Link>
            <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "bg-transparent border-2 border-cream text-cream hover:bg-cream/10 font-semibold px-10 text-base min-w-[200px]")}>
              Browse Plants
            </Link>
          </div>
        </div>
      </section>


    </div>
  );
}