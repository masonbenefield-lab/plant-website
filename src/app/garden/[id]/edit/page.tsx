import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GardenForm } from "@/components/garden/garden-form";
import { ChevronLeft } from "lucide-react";
import type { GardenPlantStatus } from "@/lib/garden-types";

export default async function EditGardenPlantPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { from } = await searchParams;
  const returnTo = from === "garden" ? "/garden" : null;

  const { data: plant } = await supabase
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, source_name, source_type, source_listing_id, notes, public_notes, images, water_interval_days, fertilize_interval_days, repot_interval_days, prune_interval_days, from_user_id, origin_verified")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!plant) notFound();

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link
          href={returnTo ?? `/garden/${plant.id}`}
          scroll={!returnTo}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ChevronLeft size={16} />
          {returnTo ? "My Garden" : plant.name}
        </Link>
        <h1 className="text-2xl font-bold">Edit plant</h1>
      </div>
      <GardenForm
        mode="edit"
        returnTo={returnTo ?? undefined}
        plant={{
          id: plant.id,
          name: plant.name,
          variety: plant.variety,
          status: plant.status as GardenPlantStatus,
          location: plant.location,
          planted_at: plant.planted_at,
          source_name: plant.source_name,
          source_type: plant.source_type,
          source_listing_id: plant.source_listing_id ?? null,
          notes: plant.notes,
          public_notes: plant.public_notes ?? null,
          images: plant.images ?? [],
          water_interval_days: plant.water_interval_days ?? null,
          fertilize_interval_days: plant.fertilize_interval_days ?? null,
          repot_interval_days: plant.repot_interval_days ?? null,
          prune_interval_days: plant.prune_interval_days ?? null,
          from_user_id: plant.from_user_id ?? null,
          origin_verified: plant.origin_verified ?? false,
        }}
      />
    </div>
  );
}
