import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import { GiveawayAdminTabs } from "./giveaway-admin-tabs";

export default async function AdminGiveawayPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/");

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [{ data: months }, { data: requests }] = await Promise.all([
    admin
      .from("giveaway_months")
      .select("month, plant_name, description, image_url, sponsor_name, sponsor_username, sponsor_logo_url, sponsor_message")
      .order("month", { ascending: false })
      .limit(12),
    admin
      .from("giveaway_sponsor_requests")
      .select("id, item_name, message, status, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const { data: requesters } = userIds.length
    ? await admin.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
    : { data: [] };
  const requesterMap = Object.fromEntries((requesters ?? []).map((p) => [p.id, p]));

  return (
    <GiveawayAdminTabs
      months={months ?? []}
      requests={requests ?? []}
      requesterMap={requesterMap}
    />
  );
}
