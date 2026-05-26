import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GardenTabs from "@/components/garden/garden-tabs";
import { WishlistClient } from "@/components/garden/wishlist-client";

export default async function WishlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: items } = await supabase
    .from("wishlist_items")
    .select("id, name, variety, notes, priority, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Garden</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Plants you want to grow someday</p>
      </div>

      <GardenTabs />

      <WishlistClient initialItems={items ?? []} />
    </div>
  );
}
