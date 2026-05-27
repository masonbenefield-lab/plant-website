import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { ArrowLeftRight, MessageSquare, Store } from "lucide-react";
import type { Metadata } from "next";
import type { Database } from "@/lib/supabase/types";
import { GardenPublicGrid } from "@/components/garden/garden-public-grid";
import type { GardenPlantStatus } from "@/lib/supabase/types";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url, bio, garden_bio, garden_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) return { title: "Garden · Plantet" };

  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;
  const title = `${displayName} Garden · Plantet`;
  const description =
    profile.garden_bio ||
    profile.bio ||
    `Browse ${displayName} plant collection on Plantet.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      ...(profile.avatar_url && { images: [{ url: profile.avatar_url, width: 400, height: 400 }] }),
      type: "profile",
    },
    twitter: {
      card: "summary",
      title,
      description,
      ...(profile.avatar_url && { images: [profile.avatar_url] }),
    },
  };
}

export default async function PublicGardenPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, bio, garden_public, stripe_onboarded, garden_bio, open_to_trades")
    .eq("username", username)
    .single();

  if (!profile || !profile.garden_public) notFound();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: plants } = await admin
    .from("garden_plants")
    .select("id, name, variety, status, location, planted_at, images, public_notes")
    .eq("user_id", profile.id)
    .or("is_public.eq.true,is_public.is.null")
    .order("created_at", { ascending: false });

  const total = plants?.length ?? 0;
  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 space-y-10">

      {/* Hero header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-muted overflow-hidden shrink-0 ring-2 ring-green-100">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName ?? ""}
              width={64}
              height={64}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
              {displayName?.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{displayName} Garden</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total} plant{total !== 1 ? "s" : ""}
          </p>
          {profile.garden_bio && (
            <p className="text-sm text-green-800 dark:text-green-300 mt-1.5 leading-relaxed max-w-lg font-medium">
              {profile.garden_bio}
            </p>
          )}
          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-lg">
              {profile.bio}
            </p>
          )}
          {profile.open_to_trades && (
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-100 dark:bg-green-900/40 dark:text-green-400 px-2.5 py-1 rounded-full">
                <ArrowLeftRight size={11} />
                Open to trades
              </span>
              <Link
                href={`/messages?to=${profile.username}`}
                className="text-xs text-muted-foreground hover:text-green-700 hover:underline flex items-center gap-1"
              >
                <MessageSquare size={11} />
                Message to arrange
              </Link>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={`/sellers/${profile.username}`}
            className="flex items-center gap-1.5 text-sm px-4 py-2 rounded-full border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 transition-colors font-medium"
          >
            <Store size={14} />
            Visit shop
          </Link>
        </div>
      </div>

      <GardenPublicGrid plants={(plants ?? []).map((p) => ({ ...p, images: p.images as string[] | null }))} username={username} />

      <p className="text-center text-xs text-muted-foreground pt-4">
        Shared on{" "}
        <Link href="/" className="text-green-700 hover:underline font-medium">
          Plantet
        </Link>
      </p>
    </div>
  );
}
