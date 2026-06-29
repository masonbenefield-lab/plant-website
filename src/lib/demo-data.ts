import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { DEMO_GARDEN_USERNAME } from "@/lib/demo";

function admin() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type DemoProfile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  garden_bio: string | null;
};

/** Curated demo account that backs the demo's data tabs. Null if not set up yet. */
export async function getDemoProfile(): Promise<DemoProfile | null> {
  const { data } = await admin()
    .from("profiles")
    .select("id, username, display_name, avatar_url, garden_bio")
    .eq("username", DEMO_GARDEN_USERNAME)
    .maybeSingle();
  return data ?? null;
}

export async function getDemoPlants(userId: string) {
  const { data } = await admin()
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images, public_notes, pin_order")
    .eq("user_id", userId)
    .or("is_public.eq.true,is_public.is.null")
    .order("pin_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });
  return (data ?? []).map((p) => ({
    ...p,
    images: p.images as string[] | null,
    pin_order: (p as { pin_order?: number | null }).pin_order ?? null,
  }));
}

export async function getDemoWishlist(userId: string) {
  const { data } = await admin()
    .from("wishlist_items")
    .select("id, name, variety, notes, priority")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
