import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { GardenVisibilityToggle } from "@/components/garden/garden-visibility-toggle";
import { PlantVisibilityToggle } from "@/components/garden/plant-visibility-toggle";
import { GardenSearch } from "@/components/garden/garden-search";
import type { GardenPlantStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<GardenPlantStatus, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const STATUS_COLOR: Record<GardenPlantStatus, string> = {
  thriving: "bg-green-100 text-green-700",
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
    .select("garden_public, username")
    .eq("id", user.id)
    .single();

  let query = supabase
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images, is_public")
    .eq("user_id", user.id)
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
            Import CSV
          </Link>
          <Link href="/garden/new" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800")}>
            + Add Plant
          </Link>
        </div>
      </div>

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
          <CardContent className="py-16 text-center space-y-3">
            <p className="text-4xl">🌱</p>
            <p className="font-medium text-lg">
              {status ? `No ${STATUS_LABEL[status as GardenPlantStatus]?.toLowerCase()} plants` : "Your garden is empty"}
            </p>
            {!status && (
              <p className="text-muted-foreground text-sm">
                Track your plants, care routines, and growth over time.
              </p>
            )}
            {!status && (
              <Link href="/garden/new" className={cn(buttonVariants(), "bg-green-700 hover:bg-green-800 mt-2")}>
                Add your first plant
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {plants!.map((plant) => (
            <div key={plant.id} className="relative">
              <Link href={`/garden/${plant.id}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow h-full">
                  <div className="aspect-square relative bg-muted">
                    {plant.images?.[0] ? (
                      <Image src={plant.images[0]} alt={plant.name} fill className="object-cover" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-4xl">🪴</div>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-1">
                    <p className="font-semibold text-sm leading-tight">{plant.name}</p>
                    {plant.variety && (
                      <p className="text-xs text-muted-foreground leading-tight">{plant.variety}</p>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                      <span
                        className={cn(
                          "text-xs px-1.5 py-0.5 rounded-full font-medium",
                          STATUS_COLOR[plant.status as GardenPlantStatus]
                        )}
                      >
                        {STATUS_LABEL[plant.status as GardenPlantStatus]}
                      </span>
                      {plant.location && (
                        <span className="text-xs text-muted-foreground truncate">{plant.location}</span>
                      )}
                    </div>
                    {plant.planted_at && (
                      <p className="text-xs text-muted-foreground">
                        Planted {new Date(plant.planted_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
              <div className="absolute top-2 right-2 z-10">
                <PlantVisibilityToggle
                  plantId={plant.id}
                  initialPublic={plant.is_public ?? true}
                  gardenPublic={profile?.garden_public ?? false}
                  variant="icon"
                />
              </div>
            </div>
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
          ? "bg-green-700 text-white border-green-700"
          : "bg-background text-muted-foreground border-border hover:text-foreground hover:border-green-400"
      )}
    >
      {label}
    </Link>
  );
}
