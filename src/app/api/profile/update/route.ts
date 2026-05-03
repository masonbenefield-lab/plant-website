import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { containsSlur } from "@/lib/profanity";

const USERNAME_RE = /^[a-z0-9_-]{3,30}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, bio, avatar_url, location, banner_url, show_follower_count, shipping_days, vacation_mode, vacation_until, offers_enabled } = await request.json() as {
    username: string;
    bio?: string;
    avatar_url?: string;
    location?: string;
    banner_url?: string;
    show_follower_count?: boolean;
    shipping_days?: number | null;
    vacation_mode?: boolean;
    vacation_until?: string | null;
    offers_enabled?: boolean;
  };

  if (!username || !USERNAME_RE.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters and contain only letters, numbers, _ or -" },
      { status: 400 }
    );
  }

  if (containsSlur(username)) {
    return NextResponse.json({ error: "Username contains a prohibited word" }, { status: 400 });
  }

  if (bio && containsSlur(bio)) {
    return NextResponse.json({ error: "Bio contains a prohibited word" }, { status: 400 });
  }

  if (location && containsSlur(location)) {
    return NextResponse.json({ error: "Location contains a prohibited word" }, { status: 400 });
  }

  if (location && location.length > 100) {
    return NextResponse.json({ error: "Location must be 100 characters or fewer" }, { status: 400 });
  }

  // Uniqueness check — only matters if username changed
  const { data: existing } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username)
    .neq("id", user.id)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      username,
      bio: bio ?? null,
      avatar_url: avatar_url ?? null,
      location: location ?? null,
      banner_url: banner_url ?? null,
      show_follower_count: show_follower_count ?? false,
      shipping_days: shipping_days ?? null,
      vacation_mode: vacation_mode ?? false,
      vacation_until: vacation_until ?? null,
      offers_enabled: offers_enabled ?? true,
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
