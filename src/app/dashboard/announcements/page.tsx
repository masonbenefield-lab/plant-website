import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AnnouncementComposer from "@/components/announcement-composer";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, { data: announcements }] = await Promise.all([
    supabase.from("profiles").select("username, avatar_url").eq("id", user.id).single(),
    supabase
      .from("announcements")
      .select("id, body, photos, listing_id, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Announcements</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Post updates to your followers — new arrivals, restocks, sales, and more. Appears in their feed.
        </p>
      </div>
      <AnnouncementComposer
        username={profile?.username ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        initialAnnouncements={(announcements ?? []).map((a) => ({
          id: a.id,
          body: a.body,
          photos: a.photos as string[],
          listing_id: a.listing_id,
          created_at: a.created_at,
        }))}
      />
    </div>
  );
}
