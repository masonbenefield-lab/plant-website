"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PlantVisibilityToggle } from "@/components/garden/plant-visibility-toggle";
import PinPlantButton from "@/components/garden/pin-plant-button";
import type { GardenPlantStatus } from "@/lib/supabase/types";

const STATUS_LABEL: Record<GardenPlantStatus, string> = {
  thriving: "Thriving",
  growing: "Growing",
  dormant: "Dormant",
  struggling: "Struggling",
  dead: "Dead",
};

const STATUS_COLOR: Record<GardenPlantStatus, string> = {
  thriving: "bg-[#DFE7D4] text-leaf",
  growing: "bg-emerald-100 text-emerald-700",
  dormant: "bg-yellow-100 text-yellow-700",
  struggling: "bg-orange-100 text-orange-700",
  dead: "bg-gray-100 text-gray-500",
};

interface Plant {
  id: string;
  name: string;
  variety: string | null;
  status: string;
  location: string | null;
  planted_at: string | null;
  images: string[];
  is_public: boolean | null;
  pin_order: number | null;
}

export default function GardenPlantCard({
  plant,
  gardenPublic,
}: {
  plant: Plant;
  gardenPublic: boolean;
}) {
  const [pinOrder, setPinOrder] = useState<number | null>(plant.pin_order);

  return (
    <div className="relative">
      <Card className={cn(
        "overflow-hidden hover:shadow-md transition-shadow h-full",
        pinOrder !== null && "ring-2 ring-leaf"
      )}>
        <Link href={`/garden/${plant.id}`} className="block">
          <div className="aspect-square relative bg-muted">
            {plant.images?.[0] ? (
              <Image src={plant.images[0]} alt={plant.name} fill className="object-cover" />
            ) : (
              <div className="flex items-center justify-center h-full text-4xl">🪴</div>
            )}
          </div>
        </Link>
        <CardContent className="p-3 space-y-1">
          <Link href={`/garden/${plant.id}`} className="block">
            <p className="font-semibold text-sm leading-tight">{plant.variety || plant.name}</p>
            {plant.variety && (
              <p className="text-xs text-muted-foreground leading-tight">{plant.name}</p>
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
          </Link>
          <div className="pt-1.5 border-t border-border/60 mt-1">
            <Link
              href={`/garden/${plant.id}/edit`}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors w-fit"
            >
              <Pencil size={11} />
              Edit
            </Link>
          </div>
        </CardContent>
      </Card>
      <div className="absolute top-2 right-2 z-10">
        <PlantVisibilityToggle
          plantId={plant.id}
          initialPublic={plant.is_public ?? true}
          gardenPublic={gardenPublic}
          variant="icon"
        />
      </div>
      <div className="absolute top-2 left-2 z-10">
        <PinPlantButton
          plantId={plant.id}
          initialPinOrder={pinOrder}
          onPinChange={setPinOrder}
        />
      </div>
    </div>
  );
}
