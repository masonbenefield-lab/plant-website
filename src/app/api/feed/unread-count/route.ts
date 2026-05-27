import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ hasNew: false });

  const { data: profile } = await supabase
    .from("profiles")
    .select("feed_last_seen_at")
    .eq("id", user.id)
    .single();

  const { data: follows } = await supabase
    .from("follows")
    .select("seller_id")
    .eq("follower_id", user.id);

  const sellerIds = (follows ?? []).map((f) => f.seller_id);
  if (!sellerIds.length) return NextResponse.json({ hasNew: false });

  const since = (profile?.feed_last_seen_at as string | null) ?? new Date(0).toISOString();

  const [{ count: l }, { count: a }, { count: g }, { count: n }] = await Promise.all([
    supabase.from("listings").select("id", { count: "exact", head: true }).in("seller_id", sellerIds).gt("created_at", since),
    supabase.from("auctions").select("id", { count: "exact", head: true }).in("seller_id", sellerIds).gt("created_at", since),
    supabase.from("garden_plants").select("id", { count: "exact", head: true }).in("user_id", sellerIds).not("shared_at", "is", null).gt("shared_at", since),
    supabase.from("announcements").select("id", { count: "exact", head: true }).in("seller_id", sellerIds).gt("created_at", since),
  ]);

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { count: pendingOrigin } = await admin
    .from("plant_origin_requests")
    .select("id", { count: "exact", head: true })
    .eq("verifier_user_id", user.id)
    .eq("status", "pending");

  const hasNew = (l ?? 0) + (a ?? 0) + (g ?? 0) + (n ?? 0) + (pendingOrigin ?? 0) > 0;
  return NextResponse.json({ hasNew });
}
