import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { GardenForm } from "@/components/garden/garden-form";
import { ChevronLeft } from "lucide-react";

export default async function NewGardenPlantPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; variety?: string; source_type?: string; source_name?: string; source_listing_id?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const params = await searchParams;
  const initialValues = {
    name: params.name,
    variety: params.variety,
    sourceType: params.source_type,
    sourceName: params.source_name,
    sourceListingId: params.source_listing_id,
  };
  const hasInitial = !!(params.name || params.variety);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
      <div>
        <Link href={hasInitial ? "/orders" : "/garden"} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ChevronLeft size={16} />
          {hasInitial ? "My Purchases" : "My Garden"}
        </Link>
        <h1 className="text-2xl font-bold">Add a plant</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track a plant in your garden, orchard, or collection.
        </p>
      </div>
      <GardenForm mode="add" initialValues={initialValues} />
    </div>
  );
}
