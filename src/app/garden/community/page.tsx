import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sprout, ArrowLeftRight } from "lucide-react";
import GardenTabs from "@/components/garden/garden-tabs";
import type { Database } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function CommunityGardensPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let profileQuery = admin
    .from("profiles")
    .select("id, username, display_name, avatar_url, garden_bio, open_to_trades")
    .eq("garden_public", true)
    .is("deleted_at", null)
    .order("username");

  if (user) profileQuery = profileQuery.neq("id", user.id);

  const { data: profiles } = await profileQuery;
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

      {gardens.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">No public gardens yet</p>
            <p className="text-sm text-muted-foreground">
              Make your garden public to be listed here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {gardens.map((profile) => {
            const { count, photos } = gardenMap[profile.id] ?? { count: 0, photos: [] };
            const name = profile.display_name || profile.username;
            return (
              <Link key={profile.id} href={`/gardens/${profile.username}`}>
                <Card className="overflow-hidden hover:shadow-md transition-shadow group h-full">
                  {/* 2×2 photo grid */}
                  <div className="grid grid-cols-2 gap-0.5 bg-muted aspect-[4/3]">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="relative overflow-hidden bg-muted">
                        {photos[i] ? (
                          <Image
                            src={photos[i]}
                            alt=""
                            fill
                            className="object-cover group-hover:scale-[1.03] transition-transform duration-300"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full text-2xl">🪴</div>
                        )}
                      </div>
                    ))}
                  </div>

                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage src={profile.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px] bg-green-100 text-green-700">
                          {name?.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <p className="font-semibold text-sm leading-tight truncate">{name}</p>
                      {profile.open_to_trades && (
                        <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                          <ArrowLeftRight size={9} />
                          Trades
                        </span>
                      )}
                    </div>
                    {profile.garden_bio && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {profile.garden_bio}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {count} plant{count !== 1 ? "s" : ""}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
