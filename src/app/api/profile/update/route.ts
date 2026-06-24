import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { containsSlur } from "@/lib/profanity";
import { geocodeUsZip } from "@/lib/weather";

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { username, display_name, bio, avatar_url, location, banner_url, show_follower_count, shipping_days, shipping_days_max, return_policy_type, return_policy_notes, vacation_mode, vacation_until, offers_enabled, announcement, announcement_expires_at, email_marketing_opt_in, daily_care_emails, care_push_reminders, postal_code, frost_alerts, social_links } = await request.json() as {
    username: string;
    display_name?: string | null;
    bio?: string;
    avatar_url?: string;
    location?: string;
    banner_url?: string;
    show_follower_count?: boolean;
    shipping_days?: number | null;
    shipping_days_max?: number | null;
    return_policy_type?: string | null;
    return_policy_notes?: string | null;
    vacation_mode?: boolean;
    vacation_until?: string | null;
    offers_enabled?: boolean;
    announcement?: string | null;
    announcement_expires_at?: string | null;
    email_marketing_opt_in?: boolean;
    daily_care_emails?: boolean;
    care_push_reminders?: boolean;
    postal_code?: string | null;
    frost_alerts?: boolean;
    social_links?: Record<string, string> | null;
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

  // Geocode the ZIP once on save (stored as lat/lng for the frost cron). Empty
  // zip clears coords; a transient geocode failure leaves existing coords alone.
  const postalClean = (postal_code ?? "").trim();
  let coords: { lat: number; lng: number } | null = null;
  if (postalClean) coords = await geocodeUsZip(postalClean);

  const { error } = await supabase
    .from("profiles")
    // care_push_reminders / frost columns aren't in the generated types — cast.
    .update({
      username,
      display_name: display_name ?? null,
      bio: bio ?? null,
      avatar_url: avatar_url ?? null,
      location: location ?? null,
      banner_url: banner_url ?? null,
      show_follower_count: show_follower_count ?? false,
      shipping_days: shipping_days ?? null,
      shipping_days_max: shipping_days_max ?? null,
      return_policy_type: return_policy_type ?? null,
      return_policy_notes: return_policy_notes ?? null,
      vacation_mode: vacation_mode ?? false,
      vacation_until: vacation_until ?? null,
      offers_enabled: offers_enabled ?? true,
      announcement: announcement ?? null,
      announcement_expires_at: announcement ? (announcement_expires_at ?? null) : null,
      email_marketing_opt_in: email_marketing_opt_in ?? false,
      daily_care_emails: daily_care_emails ?? true,
      care_push_reminders: care_push_reminders ?? false,
      postal_code: postalClean || null,
      frost_alerts: frost_alerts ?? true,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
      ...(!postalClean ? { lat: null, lng: null } : {}),
      social_links: social_links && Object.keys(social_links).length > 0 ? social_links : null,
    } as never)
    .eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
