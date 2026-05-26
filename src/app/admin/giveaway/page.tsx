import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import { GiveawayAdminClient } from "./giveaway-admin-client";
import { SponsorRequestsPanel } from "./sponsor-requests-panel";

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
      .select("month, plant_name, image_url, sponsor_name, sponsor_username, sponsor_logo_url, sponsor_message")
      .order("month", { ascending: false })
      .limit(12),
    admin
      .from("giveaway_sponsor_requests")
      .select("id, item_name, message, status, created_at, user_id")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  // Fetch requester profiles
  const userIds = [...new Set((requests ?? []).map((r) => r.user_id))];
  const { data: requesters } = userIds.length
    ? await admin.from("profiles").select("id, username, display_name, avatar_url").in("id", userIds)
    : { data: [] };
  const requesterMap = Object.fromEntries((requesters ?? []).map((p) => [p.id, p]));

  return (
    <div className="p-8 max-w-3xl space-y-10">
      {/* Donation requests */}
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Donation Requests</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Users who want to sponsor a giveaway. Reply via their messages inbox.
          </p>
        </div>
        <SponsorRequestsPanel requests={requests ?? []} requesterMap={requesterMap} />
      </div>

      {/* Sponsor settings per month */}
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Monthly Sponsors</h2>
          <p className="text-muted-foreground text-sm mt-1">Set the sponsor shown on the public giveaway page.</p>
        </div>
        <GiveawayAdminClient months={months ?? []} />
      </div>
    </div>
  );
}
