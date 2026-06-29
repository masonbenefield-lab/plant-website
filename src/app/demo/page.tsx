import type { Metadata } from "next";
import GardenTabs from "@/components/garden/garden-tabs";
import { GardenPublicGrid } from "@/components/garden/garden-public-grid";
import { DemoBanner, DemoHeaderActions } from "@/components/demo/demo-chrome";
import { getDemoProfile, getDemoPlants } from "@/lib/demo-data";
import { DEMO_DISPLAY_NAME, DEMO_GARDEN_USERNAME } from "@/lib/demo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "See Plantet in action · Plantet",
  description: "Explore an example garden — track plants, care schedules, and a wishlist. Then start your own, free.",
};

export default async function DemoGardenPage() {
  const profile = await getDemoProfile();
  const plants = profile ? await getDemoPlants(profile.id) : [];
  const name = profile?.display_name || DEMO_DISPLAY_NAME;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <DemoBanner />

      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {plants.length} plant{plants.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <DemoHeaderActions />
      </div>

      <GardenTabs basePath="/demo" />

      <GardenPublicGrid
        plants={plants}
        username={profile?.username ?? DEMO_GARDEN_USERNAME}
        currentUserId={null}
        ownerId={profile?.id ?? null}
        from="demo"
      />
      {/* name is used only for accessible context; keeps the demo honest about whose garden this is */}
      <span className="sr-only">Example garden by {name}</span>
    </div>
  );
}
