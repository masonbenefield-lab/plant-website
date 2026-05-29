import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/supabase/types";
import { EnterButton } from "./enter-button";
import { SponsorRequestForm } from "./sponsor-request-form";
import { ReferralCard } from "./referral-card";
import { Gift, Users, Trophy } from "lucide-react";

export default async function GiveawayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const now = new Date();
  const month = now.toISOString().slice(0, 7); // "2026-05"
  const monthLabel = now.toLocaleDateString("en-US", { month: "long", year: "numeric" }); // "May 2026"
  const deadline = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); // "May 31, 2026"

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonth = nextMonthDate.toISOString().slice(0, 7); // "2026-06"
  const nextMonthLabel = nextMonthDate.toLocaleDateString("en-US", { month: "long", year: "numeric" }); // "June 2026"
  const nextMonthOpens = nextMonthDate.toLocaleDateString("en-US", { month: "long", day: "numeric" }); // "June 1"

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Current month giveaway + next month teaser + past winners (last 3 months)
  const [{ data: giveaway }, { count: entryCount }, { data: nextGiveaway }, { data: pastGiveaways }] = await Promise.all([
    supabase.from("giveaway_months").select("*, sponsor_name, sponsor_username, sponsor_logo_url, sponsor_message").eq("month", month).single(),
    admin.from("giveaway_entries").select("*", { count: "exact", head: true }).eq("month", month),
    admin.from("giveaway_months").select("plant_name, description, image_url, sponsor_name, sponsor_username").eq("month", nextMonth).single(),
    admin
      .from("giveaway_months")
      .select("month, plant_name, image_url, winner_user_id, sponsor_name, sponsor_username")
      .not("winner_user_id", "is", null)
      .order("month", { ascending: false })
      .limit(3),
  ]);

  // Fetch winner usernames
  const winnerIds = (pastGiveaways ?? []).map((g) => g.winner_user_id).filter(Boolean) as string[];
  const { data: winnerProfiles } = winnerIds.length
    ? await admin.from("profiles").select("id, username").in("id", winnerIds)
    : { data: [] as { id: string; username: string }[] };
  const winnerMap = Object.fromEntries((winnerProfiles ?? []).map((p) => [p.id, p.username]));

  // Check if current user has already entered + has open sponsor request + referral data
  let alreadyEntered = false;
  let hasOpenSponsorRequest = false;
  let referralCode: string | null = null;
  let bonusEntriesThisMonth = 0;
  let userCountry: string | null = null;

  if (user) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const [{ data: entry }, { data: sponsorReq }, { data: profile }, { count: bonusCount }] = await Promise.all([
      giveaway
        ? supabase.from("giveaway_entries").select("id").eq("user_id", user.id).eq("month", month).single()
        : Promise.resolve({ data: null }),
      supabase.from("giveaway_sponsor_requests").select("id").eq("user_id", user.id).eq("status", "open").maybeSingle(),
      admin.from("profiles").select("referral_code, country").eq("id", user.id).single(),
      admin.from("referral_activations").select("id", { count: "exact", head: true })
        .eq("referrer_id", user.id)
        .gte("activated_at", monthStart),
    ]);

    alreadyEntered = !!entry;
    hasOpenSponsorRequest = !!sponsorReq;
    bonusEntriesThisMonth = bonusCount ?? 0;
    userCountry = profile?.country ?? null;

    // Backfill referral code for existing users who signed up before this feature
    if (profile?.referral_code) {
      referralCode = profile.referral_code;
    } else {
      const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
      let code: string | null = null;
      for (let i = 0; i < 5; i++) {
        const candidate = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
        const { data: existing } = await admin.from("profiles").select("id").eq("referral_code", candidate).maybeSingle();
        if (!existing) { code = candidate; break; }
      }
      if (code) {
        await admin.from("profiles").update({ referral_code: code }).eq("id", user.id);
        referralCode = code;
      }
    }
  }

  const monthName = (m: string) => {
    const [y, mo] = m.split("-").map(Number);
    return new Date(y, mo - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-16">

      {/* Header */}
      <div className="text-center space-y-2">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-green-700 bg-green-100 px-3 py-1 rounded-full">Monthly Giveaway</span>
        <h1 className="text-3xl sm:text-4xl font-bold mt-3">{monthLabel} Giveaway</h1>
        <p className="text-muted-foreground">One lucky winner gets a free plant shipped to their door. New giveaway every month.</p>
      </div>

      {giveaway ? (
        <>
          {/* Sponsor banner */}
          {giveaway.sponsor_name && (
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-5 py-4 flex items-center gap-4">
              {giveaway.sponsor_logo_url && (
                <div className="relative w-20 h-20 rounded-full overflow-hidden shrink-0">
                  <Image src={giveaway.sponsor_logo_url} alt={giveaway.sponsor_name} fill sizes="160px" className="object-cover" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 dark:text-green-400 mb-0.5">Prize donated by</p>
                {giveaway.sponsor_username ? (
                  <Link href={`/sellers/${giveaway.sponsor_username}`} className="font-bold text-sm hover:underline hover:text-green-700 transition-colors">
                    {giveaway.sponsor_name}
                  </Link>
                ) : (
                  <p className="font-bold text-sm">{giveaway.sponsor_name}</p>
                )}
                {giveaway.sponsor_message && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{giveaway.sponsor_message}</p>
                )}
              </div>
              {giveaway.sponsor_username && (
                <Link
                  href={`/sellers/${giveaway.sponsor_username}`}
                  className="shrink-0 text-xs font-medium text-green-700 hover:underline whitespace-nowrap"
                >
                  Visit shop →
                </Link>
              )}
            </div>
          )}

          {/* Plant card */}
          <div className="rounded-2xl border overflow-hidden shadow-sm">
            {giveaway.image_url && (
              <div className="relative w-full aspect-[4/3] bg-black">
                <Image src={giveaway.image_url} alt={giveaway.plant_name} fill sizes="(max-width: 768px) 100vw, 800px" className="object-contain" />
              </div>
            )}
            <div className="p-6 sm:p-8 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-1">This month&apos;s prize</p>
                <h2 className="text-2xl font-bold">{giveaway.plant_name}</h2>
                {giveaway.description && (
                  <p className="text-muted-foreground mt-2">{giveaway.description}</p>
                )}
              </div>
              <div className="flex items-center gap-6 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5">
                  <Users size={14} />
                  {entryCount ?? 0} {entryCount === 1 ? "person" : "people"} entered
                </span>
                <span>Entries close {deadline}</span>
              </div>
              <div className="pt-2">
                {!user ? (
                  <div className="space-y-2">
                    <Link href="/login" className={cn(buttonVariants({ size: "lg" }), "bg-green-700 hover:bg-green-800 text-white px-10 text-base")}>
                      Sign in to Enter
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t have an account?{" "}
                      <Link href="/signup" className="underline hover:text-foreground">Sign up free</Link>
                    </p>
                  </div>
                ) : (
                  <EnterButton monthLabel={monthLabel} initialEntered={alreadyEntered} referralCode={referralCode} userCountry={userCountry} />
                )}
              </div>
            </div>
          </div>

          {/* Next month teaser */}
          {nextGiveaway && (
            <div className="rounded-2xl border border-dashed overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 bg-muted/50 border-b border-dashed">
                <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Coming in {nextMonthLabel}</span>
              </div>
              <div className="flex gap-4 p-5 items-center">
                {nextGiveaway.image_url && (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image src={nextGiveaway.image_url} alt={nextGiveaway.plant_name} fill className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-lg">{nextGiveaway.plant_name}</p>
                  {nextGiveaway.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{nextGiveaway.description}</p>
                  )}
                  {nextGiveaway.sponsor_name && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Donated by{" "}
                      {nextGiveaway.sponsor_username ? (
                        <Link href={`/sellers/${nextGiveaway.sponsor_username}`} className="font-medium hover:underline hover:text-green-700 transition-colors">
                          {nextGiveaway.sponsor_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{nextGiveaway.sponsor_name}</span>
                      )}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">Entries open {nextMonthOpens} — come back to enter</p>
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: <Gift size={20} />, title: "1. Enter each month", desc: "Come back each month and click Enter to Win. Your entry resets every month." },
                { icon: <Users size={20} />, title: "2. We pick a winner", desc: "On the last day of the month, one entry is chosen at random." },
                { icon: <Trophy size={20} />, title: "3. Win a free plant", desc: "The winner gets the featured plant shipped free to their door." },
              ].map((s) => (
                <div key={s.title} className="rounded-xl border p-4 space-y-2">
                  <div className="text-green-700">{s.icon}</div>
                  <p className="font-semibold text-sm">{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl">🌱</p>
          <p className="text-lg font-semibold">No active giveaway right now</p>
          <p className="text-muted-foreground text-sm">Check back soon — a new plant is announced each month.</p>
        </div>
      )}

      {/* Referral card */}
      {user && referralCode ? (
        <ReferralCard referralCode={referralCode} bonusEntries={bonusEntriesThisMonth} />
      ) : !user ? (
        <div className="rounded-2xl border border-dashed p-6 text-center space-y-2">
          <p className="font-semibold flex items-center justify-center gap-2">
            <Gift size={18} className="text-green-700" />
            Get bonus entries
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-green-700 hover:underline font-medium">Sign in</Link> to get your referral link and earn extra entries.
          </p>
        </div>
      ) : null}

      {/* Past winners */}
      {pastGiveaways && pastGiveaways.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold">Past Winners</h2>
          <div className="divide-y rounded-xl border overflow-hidden">
            {pastGiveaways.map((g) => (
              <div key={g.month} className="flex items-center gap-4 px-4 py-3">
                {g.image_url ? (
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <Image src={g.image_url} alt={g.plant_name} fill className="object-cover" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-xl shrink-0">🌿</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{g.plant_name}</p>
                  <p className="text-xs text-muted-foreground">{monthName(g.month)}</p>
                  {g.sponsor_name && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Donated by{" "}
                      {g.sponsor_username ? (
                        <Link href={`/sellers/${g.sponsor_username}`} className="hover:text-green-700 hover:underline transition-colors font-medium">
                          {g.sponsor_name}
                        </Link>
                      ) : (
                        <span className="font-medium">{g.sponsor_name}</span>
                      )}
                    </p>
                  )}
                </div>
                {g.winner_user_id && winnerMap[g.winner_user_id] && (
                  <Link href={`/sellers/${winnerMap[g.winner_user_id]}`} className="flex items-center gap-1.5 shrink-0 hover:text-green-700 transition-colors">
                    <Trophy size={13} className="text-amber-500" />
                    <span className="text-xs font-medium hover:underline">{winnerMap[g.winner_user_id]}</span>
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Sponsor donation request */}
      {user ? (
        <SponsorRequestForm hasOpenRequest={hasOpenSponsorRequest} />
      ) : (
        <div className="rounded-2xl border border-dashed p-6 text-center space-y-2">
          <p className="font-semibold flex items-center justify-center gap-2">
            <Gift size={18} className="text-green-700" />
            Want to donate a prize?
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/login" className="text-green-700 hover:underline font-medium">Sign in</Link> to submit a donation request for a future giveaway.
          </p>
        </div>
      )}
    </div>
  );
}
