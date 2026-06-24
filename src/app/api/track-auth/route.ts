import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { clientIp, hashIp } from "@/lib/track-auth";

// Node runtime so the `crypto` HMAC is available (not the edge runtime).
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Anonymous visitors are a silent no-op — nothing to attribute the event to.
  if (!user) return NextResponse.json({ ok: true });

  let event = "session";
  try {
    const body = await request.json();
    if (body && typeof body.event === "string") event = body.event.slice(0, 20);
  } catch {
    // no/invalid body — keep the default
  }

  const ipHash = hashIp(clientIp(request.headers));
  const country = request.headers.get("x-vercel-ip-country");
  const ua = request.headers.get("user-agent");

  // Untyped admin client (no Database generic) so the new auth_events table —
  // not in the generated types yet — can be written without a cast.
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await admin.from("auth_events").insert({
    user_id: user.id,
    event,
    ip_hash: ipHash,
    country: country ?? null,
    user_agent: ua ? ua.slice(0, 300) : null,
  });

  return NextResponse.json({ ok: true });
}
