import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendReengagementEmail, type DigestListing } from "@/lib/email";

export const maxDuration = 300;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const INACTIVE_DAYS = 45;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fortyFiveDaysAgo = new Date(Date.now() - INACTIVE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 1 — opted-in users who haven't received a re-engagement email recently
  const { data: profiles, error: profileErr } = await admin
    .from("profiles")
    .select("id, username")
    .eq("email_marketing_opt_in", true)
    .or(`last_reengagement_sent.is.null,last_reengagement_sent.lt.${fortyFiveDaysAgo}`);

  if (profileErr || !profiles?.length) {
    return NextResponse.json({ sent: 0, error: profileErr?.message ?? "No eligible users" });
  }

  // 2 — get emails + last_sign_in_at from auth
  const { data: authData } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  const lastSignInMap: Record<string, string | null> = {};
  for (const u of authData?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
    lastSignInMap[u.id] = u.last_sign_in_at ?? null;
  }

  // 3 — filter to users inactive for 45+ days
  const inactiveProfiles = profiles.filter((p) => {
    const lastSignIn = lastSignInMap[p.id];
    if (!lastSignIn) return true; // never signed in — also re-engage
    return lastSignIn < fortyFiveDaysAgo;
  });

  if (!inactiveProfiles.length) {
    return NextResponse.json({ sent: 0, total: profiles.length, reason: "No inactive users" });
  }

  // 4 — get Grower+ seller IDs for email content
  const { data: growerPlusSellers } = await admin
    .from("profiles")
    .select("id")
    .in("plan", ["grower", "nursery"]);
  const growerPlusIds = (growerPlusSellers ?? []).map((s) => s.id);

  // 5 — get fresh Grower+ listings (1 per seller, up to 6)
  const { data: listingsRaw } = growerPlusIds.length
    ? await admin
        .from("listings")
        .select("id, plant_name, variety, price_cents, images, seller_id")
        .eq("status", "active")
        .in("seller_id", growerPlusIds)
        .not("images", "eq", "{}")
        .not("images", "is", null)
        .order("created_at", { ascending: false })
        .limit(120)
    : { data: [] };

  const seenSellers = new Set<string>();
  const listingPool = (listingsRaw ?? [])
    .filter((l) => (l.images as string[])?.[0])
    .filter((l) => {
      if (seenSellers.has(l.seller_id)) return false;
      seenSellers.add(l.seller_id);
      return true;
    })
    .slice(0, 6);

  // 6 — resolve seller usernames
  const sellerIds = [...new Set(listingPool.map((l) => l.seller_id))];
  const { data: sellers } = sellerIds.length
    ? await admin.from("profiles").select("id, username").in("id", sellerIds)
    : { data: [] };
  const sellerMap: Record<string, string> = Object.fromEntries(
    (sellers ?? []).map((s) => [s.id, s.username])
  );

  const freshListings: DigestListing[] = listingPool.map((l) => ({
    id: l.id,
    seller_id: l.seller_id,
    plant_name: l.plant_name,
    variety: l.variety,
    price_cents: l.price_cents,
    images: l.images as string[],
    seller_username: sellerMap[l.seller_id] ?? "",
  }));

  // 7 — send emails
  let sent = 0;
  const sentIds: string[] = [];

  for (const profile of inactiveProfiles) {
    const email = emailMap[profile.id];
    if (!email) continue;

    try {
      await sendReengagementEmail({
        recipientEmail: email,
        username: profile.username,
        userId: profile.id,
        freshListings,
      });
      sentIds.push(profile.id);
      sent++;
    } catch {
      // continue on individual send failure
    }
  }

  // 8 — mark re-engagement sent
  if (sentIds.length) {
    await admin
      .from("profiles")
      .update({ last_reengagement_sent: new Date().toISOString() })
      .in("id", sentIds);
  }

  return NextResponse.json({ sent, total: inactiveProfiles.length });
}
