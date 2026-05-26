import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import GardenTabs from "@/components/garden/garden-tabs";
import CommunityGardensGrid from "@/components/garden/community-gardens-grid";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CommunityGardensPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profiles } = await admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, garden_bio, open_to_trades")
    .eq("garden_public", true)
    .is("deleted_at", null)
    .order("username");
  const profileIds = profiles?.map((p) => p.id) ?? [];

  const { data: plants } = profileIds.length
    ? await admin
        .from("garden_plants")
        .select("user_id, images, pin_order, name")
        .in("user_id", profileIds)
        .or("is_public.eq.true,is_public.is.null")
        .order("pin_order", { ascending: true, nullsFirst: false })
    : { data: [] };

  // Per-user: pinned photos first (up to 4), then fill from unpinned, track count
  type GardenSummary = { count: number; photos: string[] };
  const gardenMap: Record<string, GardenSummary> = {};

  for (const plant of plants ?? []) {
    if (!gardenMap[plant.user_id]) gardenMap[plant.user_id] = { count: 0, photos: [] };
    gardenMap[plant.user_id].count++;
    if (gardenMap[plant.user_id].photos.length < 4 && plant.images?.[0]) {
      gardenMap[plant.user_id].photos.push(plant.images[0]);
    }
  }

  const gardens = (profiles ?? []).filter((p) => (gardenMap[p.id]?.count ?? 0) > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gardens</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Browse what the community is growing
        </p>
      </div>

      <GardenTabs />

      <CommunityGardensGrid
        gardens={gardens}
        gardenMap={gardenMap}
        currentUserId={user?.id ?? null}
      />
    </div>
  );
}
