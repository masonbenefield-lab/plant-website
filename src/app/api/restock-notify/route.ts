import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { listingId, email } = await request.json() as { listingId: string; email?: string };
  if (!listingId) return NextResponse.json({ error: "listingId required" }, { status: 400 });

  const notifyEmail = user ? undefined : email?.trim().toLowerCase();
  if (!user && (!notifyEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(notifyEmail))) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const ip = request.headers.get("x-forwarded-for") ?? "anon";
  if (!checkRateLimit(`restock:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let resolvedEmail = notifyEmail;
  if (user) {
    const { data: authUser } = await supabase.auth.getUser();
    resolvedEmail = authUser.user?.email;
  }
  if (!resolvedEmail) return NextResponse.json({ error: "No email found" }, { status: 400 });

  const { error } = await supabase
    .from("restock_notifications")
    .insert({ listing_id: listingId, user_id: user?.id ?? null, email: resolvedEmail })
    .select()
    .single();

  // Ignore unique constraint errors (already subscribed)
  if (error && !error.message.includes("unique")) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
