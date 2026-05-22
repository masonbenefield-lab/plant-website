import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sprout, Store, ArrowLeftRight, MessageSquare } from "lucide-react";
import type { GardenPlantStatus, Database } from "@/lib/supabase/types";

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
    .select("id, username, display_name, avatar_url, bio, garden_public, stripe_onboarded, garden_bio, open_to_trades")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) notFound();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: plants } = await admin
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images, public_notes")
    .eq("user_id", profile.id)
    .or("is_public.eq.true,is_public.is.null")
    .order("created_at", { ascending: false });

  const total = plants?.length ?? 0;
  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">

      {/* Hero header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-muted overflow-hidden shrink-0 ring-2 ring-green-100">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName ?? ""}
              width={64}
              height={64}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
              {displayName?.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{displayName} Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} plant{total !== 1 ? "s" : ""}
          </p>
          {profile.garden_bio && (
            <p className="text-sm text-green-800 dark:text-green-300 mt-1.5 leading-relaxed max-w-lg font-medium">
              {profile.garden_bio}
            </p>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-lg">
              {profile.bio}
            </p>
          )}
          {profile.open_to_trades && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-2.5 py-1 rounded-full">
                <ArrowLeftRight size={11} />
                Open to trades
              </span>
              <Link
                href={`/messages?to=${profile.username}`}
                className="text-xs text-muted-foreground hover:text-green-700 hover:underline flex items-center gap-1"
              >
                <MessageSquare size={11} />
                Message to arrange
              </Link>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {profile.stripe_onboarded && (
            <Link
              href={`/sellers/${profile.username}`}
              className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
            >
              <Store size={14} />
              Visit shop
            </Link>
          )}
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
          {plants!.map((plant) => (
            <Link key={plant.id} href={`/gardens/${username}/${plant.id}`}>
              <Card className="overflow-hidden h-full hover:shadow-md transition-shadow group">
                <div className="aspect-[4/3] relative bg-muted">
                  {plant.images?.[0] ? (
                    <Image
                      src={plant.images[0]}
                      alt={plant.name}
                      fill
                      className="object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-5xl">🪴</div>
                  )}
                </div>
                <CardContent className="p-4 space-y-1.5">
                  <p className="font-semibold leading-tight">{plant.name}</p>
                  {plant.variety && (
                    <p className="text-sm text-muted-foreground leading-tight">{plant.variety}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap pt-0.5">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[plant.status as GardenPlantStatus])}>
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
                  {(plant as { public_notes?: string | null }).public_notes && (
                    <p className="text-sm text-muted-foreground leading-snug line-clamp-2 pt-1 border-t">
                      {(plant as { public_notes?: string | null }).public_notes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pt-4">
        Shared on{" "}
        <Link href="/" className="text-green-700 hover:underline font-medium">
          Plantet
        </Link>
      </p>
    </div>
  );
}
