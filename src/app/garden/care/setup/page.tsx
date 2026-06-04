import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SetupClient } from "./setup-client";

export default async function CareSetupPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/garden/care/setup");

  const { data: plants } = await supabase
    .from("garden_plants")
    .select("id, name, variety, images, location")
    .eq("user_id", user.id)
    .is("water_interval_days", null)
    .is("fertilize_interval_days", null)
    .is("repot_interval_days", null)
    .is("prune_interval_days", null)
    .order("name", { ascending: true });

  if (!plants?.length) redirect("/garden/care");

  return <SetupClient plants={plants.map((p) => ({
    id: p.id,
    name: p.name,
    variety: p.variety,
    image: (p.images as string[] | null)?.[0] ?? null,
    location: p.location,
  }))} />;
}
