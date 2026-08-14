import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/track-auth";
import { containsSlur } from "@/lib/profanity";
import { normalizeUsername, validateUsernameFormat } from "@/lib/username";

// Node runtime — clientIp/rate-limit are shared with the other auth routes.
export const runtime = "nodejs";

/**
 * Live "is this username free?" check for the signup forms, so a collision is
 * caught while the person is typing instead of after they've submitted.
 *
 * `available: null` means "couldn't tell" — the caller should stay quiet and let
 * the submit go through rather than blocking signup on a lookup hiccup.
 *
 * Not an information leak: profiles are world-readable by design (usernames are
 * public storefront URLs). Rate limited anyway to keep it from being a cheap way
 * to enumerate the whole table.
 */
export async function GET(request: Request) {
  const ip = clientIp(request.headers) ?? "unknown";
  if (!checkRateLimit(`check-username:${ip}`, 30, 60_000)) {
    return NextResponse.json({ available: null }, { status: 429 });
  }

  const username = normalizeUsername(
    new URL(request.url).searchParams.get("username") ?? ""
  );

  const formatError = validateUsernameFormat(username);
  if (formatError) {
    return NextResponse.json({ available: false, error: formatError });
  }
  if (containsSlur(username)) {
    return NextResponse.json({
      available: false,
      error: "Username contains a prohibited word.",
    });
  }

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("username", username)
    .maybeSingle();

  if (error) return NextResponse.json({ available: null });

  return data
    ? NextResponse.json({ available: false, error: "That username is already taken." })
    : NextResponse.json({ available: true });
}
