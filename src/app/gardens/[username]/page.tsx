import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sprout } from "lucide-react";
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

export default async function PublicGardenPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, garden_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) notFound();

  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const total = plants?.length ?? 0;
  const displayName = profile.display_name || profile.username;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-muted overflow-hidden shrink-0">
          {profile.avatar_url ? (
            <Image src={profile.avatar_url} alt={displayName ?? ""} width={48} height={48} className="object-cover w-full h-full" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground">
              {displayName?.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{displayName}&apos;s Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} plant{total !== 1 ? "s" : ""}
            {" · "}
            <Link href={`/sellers/${profile.username}`} className="text-green-700 hover:underline">
              Visit storefront
            </Link>
          </p>
        </div>
      </div>

      {total === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">No plants added yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {plants!.map((plant) => (
            <Card key={plant.id} className="overflow-hidden h-full">
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
                  <p className="text-xs text-muted-foreground">{plant.variety}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", STATUS_COLOR[plant.status as GardenPlantStatus])}>
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
          ))}
        </div>
      )}
    </div>
  );
}
