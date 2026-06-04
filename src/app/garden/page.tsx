import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { GardenVisibilityToggle } from "@/components/garden/garden-visibility-toggle";
import { GardenSearch } from "@/components/garden/garden-search";
import GardenTabs from "@/components/garden/garden-tabs";
import GardenSettings from "@/components/garden/garden-settings";
import GardenPlantCard from "@/components/garden/garden-plant-card";
import { GardenScrollRestore } from "@/components/garden/garden-scroll-restore";
import type { GardenPlantStatus } from "@/lib/garden-types";

const STATUS_LABEL: Record<GardenPlantStatus, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const STATUS_COLOR: Record<GardenPlantStatus, string> = {
  thriving: "bg-[#DFE7D4] text-leaf",
  growing: "bg-emerald-100 text-emerald-700",
  dormant: "bg-yellow-100 text-yellow-700",
  struggling: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-500",
};

export default async function GardenPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { status, q } = await searchParams;

  const { data: profile } = await supabase
    .from("profiles")
    .select("garden_public, username, garden_bio, open_to_trades, trades_disclaimer_accepted")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images, is_public, pin_order")
    .eq("user_id", user.id)
    .order("pin_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (status && ["thriving", "growing", "dormant", "struggling", "dead"].includes(status)) {
    query = query.eq("status", status as GardenPlantStatus);
  }

  if (q?.trim()) {
    query = query.or(`name.ilike.%${q.trim()}%,variety.ilike.%${q.trim()}%`);
  }

  const { data: plants } = await query;
  const total = plants?.length ?? 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      <GardenScrollRestore />
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} plant{total !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <GardenVisibilityToggle
            initialPublic={profile?.garden_public ?? false}
            username={profile?.username ?? null}
          />
          <Link href="/garden/import" className={cn(buttonVariants({ variant: "outline" }))}>
            Bulk Upload
          </Link>
          <Link href="/garden/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
            + Add Plant
          </Link>
        </div>
      </div>
      <GardenSettings
        initialBio={profile?.garden_bio ?? null}
        initialOpenToTrades={profile?.open_to_trades ?? false}
        disclaimerAccepted={profile?.trades_disclaimer_accepted ?? false}
      />

      <GardenTabs />

      {profile?.garden_public && (
        <p className="text-xs text-muted-foreground -mt-4">
          Pin up to 4 plants (📌 button on each card) to feature them on your community garden card.
        </p>
      )}

      {/* Search + filter row */}
      <div className="flex flex-wrap items-center gap-3">
        <Suspense>
          <GardenSearch />
        </Suspense>
        <div className="flex flex-wrap gap-2">
          <FilterChip href={q ? `/garden?q=${encodeURIComponent(q)}` : "/garden"} label="All" active={!status} />
          {(["thriving", "growing", "dormant", "struggling", "dead"] as GardenPlantStatus[]).map((s) => (
            <FilterChip
              key={s}
              href={`/garden?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              label={STATUS_LABEL[s]}
              active={status === s}
            />
          ))}
        </div>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-6">
            <div>
              <p className="text-5xl mb-3">🌱</p>
              <p className="font-semibold text-xl">
                {status ? `No ${STATUS_LABEL[status as GardenPlantStatus]?.toLowerCase()} plants` : "Your garden is empty"}
              </p>
              {!status && (
                <p className="text-muted-foreground text-sm mt-1 max-w-sm mx-auto">
                  My Garden is your personal plant journal. Track what you grow, log care, and share your collection with followers.
                </p>
              )}
            </div>
            {!status && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto text-left">
                {[
                  { icon: "📋", title: "Track your plants", body: "Log every plant you own with photos, health status, and location." },
                  { icon: "💧", title: "Care reminders", body: "Set watering, fertilizing, and repotting intervals — get reminded when due." },
                  { icon: "🌍", title: "Public garden", body: "Make your garden public so buyers can see what you grow on your storefront." },
                  { icon: "📣", title: "Share to feed", body: "Share new additions to your followers' feeds to build your grower reputation." },
                ].map(({ icon, title, body }) => (
                  <div key={title} className="rounded-lg border bg-muted/30 p-3 space-y-1">
                    <p className="text-xl">{icon}</p>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            )}
            {!status && (
              <Link href="/garden/new" className={cn(buttonVariants(), "bg-leaf hover:bg-forest")}>
                Add your first plant
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {plants!.map((plant) => (
            <GardenPlantCard
              key={plant.id}
              plant={{ ...plant, pin_order: (plant as { pin_order?: number | null }).pin_order ?? null }}
              gardenPublic={profile?.garden_public ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-colors border",
        active
          ? "bg-leaf text-white border-leaf"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-sage"
      )}
    >
      {label}
    </Link>
  );
}
