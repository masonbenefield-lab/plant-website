import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";
import { PhotoGallery } from "@/components/garden/photo-gallery";
import type { Metadata } from "next";
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

const SOURCE_TYPE_LABEL: Record<string, string> = {
  nursery: "Local nursery",
  purchase: "Online purchase",
  trade: "Trade / swap",
  propagation: "Propagation",
  gift: "Gift",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}): Promise<Metadata> {
  const { username, id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username, garden_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) return { title: "Plant · Plantet" };

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: plant } = await admin
    .from("garden_plants")
    .select("name, variety, status, images, public_notes")
    .eq("id", id)
    .eq("user_id", profile.id)
    .or("is_public.eq.true,is_public.is.null")
    .single();

  if (!plant) return { title: "Plant · Plantet" };

  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;
  const plantTitle = plant.variety || plant.name;
  const title = `${plantTitle} · ${displayName} Garden`;

  const statusLabel = STATUS_LABEL[plant.status as GardenPlantStatus] ?? plant.status;
  const description = plant.public_notes
    ? `${statusLabel} · ${plant.public_notes.slice(0, 140)}${plant.public_notes.length > 140 ? "…" : ""}`
    : plant.variety
    ? `${plant.name} · ${statusLabel} · In ${displayName} garden on Plantet.`
    : `${statusLabel} · In ${displayName} garden on Plantet.`;

  const firstImage = plant.images?.[0];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(firstImage && { images: [{ url: firstImage }] }),
      type: "article",
    },
    twitter: {
      card: firstImage ? "summary_large_image" : "summary",
      title,
      description,
      ...(firstImage && { images: [firstImage] }),
    },
  };
}

export default async function PublicPlantDetailPage({
  params,
}: {
  params: Promise<{ username: string; id: string }>;
}) {
  const { username, id } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, garden_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) notFound();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: plant } = await admin
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, source_type, source_name, images, public_notes, from_user_id, origin_verified")
    .eq("id", id)
    .eq("user_id", profile.id)
    .or("is_public.eq.true,is_public.is.null")
    .single();

  if (!plant) notFound();

  // Look up verified source username if applicable
  let verifiedSourceUsername: string | null = null;
  if (plant.origin_verified && plant.from_user_id) {
    const { data: sourceProfile } = await admin
      .from("profiles")
      .select("username")
      .eq("id", plant.from_user_id)
      .single();
    verifiedSourceUsername = sourceProfile?.username ?? null;
  }

  const status = plant.status as GardenPlantStatus;
  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

      {/* Back nav */}
      <Link
        href={`/gardens/${username}`}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={16} />
        {displayName} Garden
      </Link>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{plant.variety || plant.name}</h1>
          <span className={cn("text-sm px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[status])}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        {plant.variety && (
          <p className="text-muted-foreground">{plant.name}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: photos + notes */}
        <div className="lg:col-span-2 space-y-6">
          <PhotoGallery images={plant.images ?? []} alt={plant.name} />

          {plant.public_notes && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Notes</p>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{plant.public_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: details sidebar */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Details</p>

              {plant.location && (
                <DetailRow label="Location" value={plant.location} />
              )}
              {plant.planted_at && (
                <DetailRow
                  label="Planted"
                  value={new Date(plant.planted_at).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                />
              )}
              {plant.source_type && (
                <DetailRow
                  label="Source"
                  value={SOURCE_TYPE_LABEL[plant.source_type] ?? plant.source_type}
                />
              )}
              {verifiedSourceUsername && (
                <div className="flex justify-between gap-3 text-sm">
                  <span className="text-muted-foreground shrink-0">From</span>
                  <Link
                    href={`/sellers/${verifiedSourceUsername}`}
                    className="font-medium text-green-700 hover:underline flex items-center gap-1"
                  >
                    @{verifiedSourceUsername}
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-green-600" aria-label="Verified">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Grower attribution */}
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-muted overflow-hidden shrink-0">
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={displayName ?? ""}
                    width={36}
                    height={36}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold text-muted-foreground">
                    {displayName?.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">Grown by</p>
                <Link
                  href={`/gardens/${username}`}
                  className="text-sm font-medium hover:text-green-700 transition-colors truncate block"
                >
                  {displayName}
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pt-4">
        Shared on{" "}
        <Link href="/" className="text-green-700 hover:underline font-medium">
          Plantet
        </Link>
      </p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
