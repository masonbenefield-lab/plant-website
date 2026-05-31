import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Sprout } from "lucide-react";
import type { Metadata } from "next";
import type { Database } from "@/lib/supabase/types";

type Priority = "nice" | "want" | "must";

const PRIORITY_LABEL: Record<Priority, string> = {
  nice: "Nice to have",
  want: "Want it",
  must: "Must have",
};

const PRIORITY_COLOR: Record<Priority, string> = {
  nice: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  want: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  must: "bg-[#DFE7D4] text-leaf dark:bg-forest/40 dark:text-sage",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username, avatar_url, wishlist_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.wishlist_public) return { title: "Wishlist · Plantet" };

  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;
  const title = `${displayName} Plant Wishlist · Plantet`;

  const description = `See which plants ${displayName} wants to grow next on Plantet.`;

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

export default async function PublicWishlistPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, wishlist_public, garden_public")
    .eq("username", username)
    .single();

  if (!profile || !profile.wishlist_public) notFound();

  const admin = createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: items } = await admin
    .from("wishlist_items")
    .select("id, name, variety, notes, priority")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  const rawName = profile.display_name || profile.username;
  const displayName = rawName?.endsWith("s") ? `${rawName}'` : `${rawName}'s`;

  const mustHave = (items ?? []).filter((i) => i.priority === "must");
  const want = (items ?? []).filter((i) => i.priority === "want");
  const nice = (items ?? []).filter((i) => i.priority === "nice");
  const ordered = [...mustHave, ...want, ...nice];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12 space-y-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="w-14 h-14 rounded-full bg-muted overflow-hidden shrink-0 ring-2 ring-[#DFE7D4]">
          {profile.avatar_url ? (
            <Image
              src={profile.avatar_url}
              alt={displayName ?? ""}
              width={56}
              height={56}
              className="object-cover w-full h-full"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xl font-bold text-muted-foreground">
              {displayName?.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold leading-tight">{displayName} Plant Wishlist</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {ordered.length} plant{ordered.length !== 1 ? "s" : ""} on the list
          </p>
          <div className="flex gap-3 mt-2 flex-wrap">
            {profile.garden_public && (
              <Link
                href={`/gardens/${username}`}
                className="text-xs text-leaf hover:underline font-medium"
              >
                View their garden →
              </Link>
            )}
            <Link
              href={`/sellers/${username}`}
              className="text-xs text-muted-foreground hover:text-leaf hover:underline transition-colors"
            >
              Visit their shop →
            </Link>
          </div>
        </div>
      </div>

      {/* List */}
      {ordered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Sprout className="mx-auto text-muted-foreground" size={36} />
            <p className="font-medium">Nothing on the wishlist yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {ordered.map((item) => (
            <Card key={item.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm leading-tight">
                      {item.variety || item.name}
                    </p>
                    {item.variety && (
                      <p className="text-xs text-muted-foreground">{item.name}</p>
                    )}
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLOR[item.priority as Priority])}>
                      {PRIORITY_LABEL[item.priority as Priority]}
                    </span>
                  </div>
                  {item.notes && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{item.notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground pt-4">
        Shared on{" "}
        <Link href="/" className="text-leaf hover:underline font-medium">
          Plantet
        </Link>
      </p>
    </div>
  );
}
