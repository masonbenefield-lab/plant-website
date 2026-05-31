import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import AccountForm from "./account-form";
import BlockedUsers from "@/components/account/blocked-users";

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: blockedRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    createAdmin<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
      .from("blocks")
      .select("blocked_id")
      .eq("blocker_id", user.id),
  ]);

  const blockedIds = (blockedRows ?? []).map((r) => r.blocked_id);
  const blockedProfiles =
    blockedIds.length > 0
      ? (
          await createAdmin<Database>(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          )
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", blockedIds)
        ).data ?? []
      : [];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-12">
      <div>
        <h1 className="text-2xl font-bold mb-8">Account Settings</h1>
        <AccountForm profile={profile} userId={user.id} />
      </div>
      <div className="border-t pt-8">
        <BlockedUsers initialBlocked={blockedProfiles} />
      </div>
    </div>
  );
}
