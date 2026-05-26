import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Database } from "@/lib/supabase/types";
import { GiveawayAdminClient } from "./giveaway-admin-client";

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

  const { data: months } = await admin
    .from("giveaway_months")
    .select("month, plant_name, image_url, sponsor_name, sponsor_username, sponsor_logo_url, sponsor_message")
    .order("month", { ascending: false })
    .limit(12);

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Giveaway Sponsors</h1>
        <p className="text-muted-foreground text-sm mt-1">Set the sponsor for each monthly giveaway.</p>
      </div>
      <GiveawayAdminClient months={months ?? []} />
    </div>
  );
}
