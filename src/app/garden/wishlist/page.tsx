import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import GardenTabs from "@/components/garden/garden-tabs";
import { WishlistClient } from "@/components/garden/wishlist-client";
import { WishlistVisibilityToggle } from "@/components/garden/wishlist-visibility-toggle";

export default async function WishlistPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: items }, { data: profile }] = await Promise.all([
    supabase
      .from("wishlist_items")
      .select("id, name, variety, notes, priority, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("profiles")
      .select("username, wishlist_public")
      .eq("id", user.id)
      .single(),
  ]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">My Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Plants you want to grow someday</p>
        </div>
        <WishlistVisibilityToggle
          initialPublic={profile?.wishlist_public ?? false}
          username={profile?.username}
        />
      </div>

      <GardenTabs />

      <WishlistClient initialItems={items ?? []} />
    </div>
  );
}
