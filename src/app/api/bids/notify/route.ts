import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendOutbidNotification } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { auctionId, previousBidderId, newBidCents } = await request.json() as {
    auctionId: string;
    previousBidderId: string;
    newBidCents: number;
  };

  if (!auctionId || !previousBidderId || !newBidCents) {
    return NextResponse.json({ ok: true });
  }

  // Don't notify if the outbid user is the same person placing the bid
  if (previousBidderId === user.id) {
    return NextResponse.json({ ok: true });
  }

  const admin = adminClient();
  const [{ data: { user: previousBidder } }, { data: auction }] = await Promise.all([
    admin.auth.admin.getUserById(previousBidderId),
    admin.from("auctions").select("plant_name").eq("id", auctionId).single(),
  ]);

  if (previousBidder?.email && auction) {
    await sendOutbidNotification({
      bidderEmail: previousBidder.email,
      plantName: auction.plant_name,
      auctionId,
      newBidCents,
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true });
}
