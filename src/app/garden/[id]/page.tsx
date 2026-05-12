import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { EventLog } from "@/components/garden/event-log";
import { ChevronLeft, Pencil } from "lucide-react";
import type { GardenPlantStatus, GardenEventType } from "@/lib/supabase/types";
import { DeletePlantButton } from "@/components/garden/delete-plant-button";
import { PlantVisibilityToggle } from "@/components/garden/plant-visibility-toggle";
import { SharePlantButton } from "@/components/garden/share-plant-button";

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

export default async function GardenPlantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [{ data: plant }, { data: events }, { data: profile }] = await Promise.all([
    supabase
      .from("garden_plants")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("garden_events")
      .select("id, event_type, event_date, notes, photos, created_at")
      .eq("plant_id", id)
      .order("event_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("garden_public")
      .eq("id", user.id)
      .single(),
  ]);

  if (!plant) notFound();

  const status = plant.status as GardenPlantStatus;
  const gardenPublic = profile?.garden_public ?? false;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">

      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4">
        <Link href="/garden" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft size={16} />
          My Garden
        </Link>
        <div className="flex items-center gap-2">
          <SharePlantButton
            plantId={plant.id}
            plantName={plant.name}
            isPublic={plant.is_public ?? true}
            gardenPublic={gardenPublic}
          />
          <Link
            href={`/garden/${plant.id}/edit`}
            className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-1.5")}
          >
            <Pencil size={14} />
            Edit
          </Link>
          <DeletePlantButton plantId={plant.id} plantName={plant.name} />
        </div>
      </div>

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{plant.name}</h1>
          <span className={cn("text-sm px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[status])}>
            {STATUS_LABEL[status]}
          </span>
        </div>
        {plant.variety && (
          <p className="text-muted-foreground">{plant.variety}</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left: photos + details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Photo gallery */}
          {plant.images && plant.images.length > 0 ? (
            <div>
              <div className="aspect-video relative rounded-xl overflow-hidden bg-muted mb-3">
                <Image src={plant.images[0]} alt={plant.name} fill className="object-cover" />
              </div>
              {plant.images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {plant.images.map((url: string, i: number) => (
                    <div key={i} className="w-20 h-20 shrink-0 relative rounded-lg overflow-hidden bg-muted">
                      <Image src={url} alt={`${plant.name} photo ${i + 1}`} fill className="object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="aspect-video rounded-xl bg-muted flex items-center justify-center text-6xl">
              🪴
            </div>
          )}

          {/* Notes */}
          {(plant.public_notes || plant.notes) && (
            <div className="space-y-3">
              {plant.public_notes && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Public notes</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{plant.public_notes}</p>
                  </CardContent>
                </Card>
              )}
              {plant.notes && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Private notes</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{plant.notes}</p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Event log */}
          <EventLog
            plantId={plant.id}
            initialEvents={(events ?? []) as { id: string; event_type: GardenEventType; event_date: string; notes: string | null; photos: string[]; created_at: string }[]}
          />
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
              {plant.source_name && (
                <DetailRow label="From" value={plant.source_name} />
              )}
              <DetailRow
                label="Added"
                value={new Date(plant.created_at).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              />
              <DetailRow label="Events logged" value={String(events?.length ?? 0)} />
              <div className="pt-1">
                <PlantVisibilityToggle plantId={plant.id} initialPublic={plant.is_public ?? true} gardenPublic={gardenPublic} />
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
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
