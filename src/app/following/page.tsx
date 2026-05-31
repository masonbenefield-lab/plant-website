import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import FollowingClient from "./following-client";

export const dynamic = "force-dynamic";

export default async function FollowingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: followingRows }, { data: followerRows }, { data: blockRows }] = await Promise.all([
    supabase.from("follows").select("seller_id").eq("follower_id", user.id),
    supabase.from("follows").select("follower_id").eq("seller_id", user.id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", user.id),
  ]);

  const followingIds = (followingRows ?? []).map((r) => r.seller_id);
  const followerIds = (followerRows ?? []).map((r) => r.follower_id);
  const blockedIds = (blockRows ?? []).map((r) => r.blocked_id);

  const allIds = [...new Set([...followingIds, ...followerIds, ...blockedIds])];

  const { data: profiles } = allIds.length
    ? await supabase.from("profiles").select("id, username, display_name, avatar_url").in("id", allIds)
    : { data: [] };

  const profileMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (
    <Suspense>
      <FollowingClient
        currentUserId={user.id}
        followingIds={followingIds}
        followerIds={followerIds}
        blockedIds={blockedIds}
        profileMap={profileMap}
      />
    </Suspense>
  );
}
