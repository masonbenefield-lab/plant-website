import type { Metadata } from "next";
import { Sprout } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import GardenTabs from "@/components/garden/garden-tabs";
import { PublicWishlistItems } from "@/components/garden/public-wishlist-items";
import { DemoBanner, DemoHeaderActions } from "@/components/demo/demo-chrome";
import { getDemoProfile, getDemoWishlist } from "@/lib/demo-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Wishlist demo · Plantet",
  description: "Keep a running list of plants you want to grow next. See how it works, then start your own.",
};

export default async function DemoWishlistPage() {
  const profile = await getDemoProfile();
  const items = profile ? await getDemoWishlist(profile.id) : [];

  const mustHave = items.filter((i) => i.priority === "must");
  const want = items.filter((i) => i.priority === "want");
  const nice = items.filter((i) => i.priority === "nice");
  const ordered = [...mustHave, ...want, ...nice];

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <DemoBanner />

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plants you want to grow someday</p>
        </div>
        <DemoHeaderActions />
      </div>

      <GardenTabs basePath="/demo" />

      {ordered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">Nothing on the wishlist yet</p>
          </CardContent>
        </Card>
      ) : (
        <PublicWishlistItems items={ordered} showSave={false} userWishlistItems={[]} />
      )}
    </div>
  );
}
