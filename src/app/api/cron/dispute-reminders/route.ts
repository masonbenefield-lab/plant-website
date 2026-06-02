import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDisputeReminderToSeller } from "@/lib/email";

export const maxDuration = 60;

const admin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Disputes in their 4th day with no seller response (1 day left in the window)
  // Window: last_replied_at between 4 and 5 days ago
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: disputes, error } = await admin
    .from("order_disputes")
    .select("id, seller_id, buyer_id, reason, last_replied_at")
    .eq("status", "seller_notified")
    .eq("last_replied_by_role", "buyer")
    .lt("last_replied_at", fourDaysAgo)
    .gt("last_replied_at", fiveDaysAgo);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!disputes?.length) return NextResponse.json({ sent: 0 });

  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const emailMap: Record<string, string> = {};
  for (const u of authUsers?.users ?? []) {
    if (u.email) emailMap[u.id] = u.email;
  }

  const buyerIds = [...new Set(disputes.map(d => d.buyer_id))];
  const { data: buyerProfiles } = await admin
    .from("profiles")
    .select("id, username, display_name")
    .in("id", buyerIds);

  const buyerNameMap: Record<string, string> = {};
  for (const p of buyerProfiles ?? []) {
    buyerNameMap[p.id] = (p as { display_name?: string | null; username?: string | null }).display_name ?? p.username ?? "A buyer";
  }

  let sent = 0;
  for (const dispute of disputes) {
    const sellerEmail = emailMap[dispute.seller_id];
    if (!sellerEmail) continue;
    try {
      await sendDisputeReminderToSeller({
        sellerEmail,
        buyerUsername: buyerNameMap[dispute.buyer_id] ?? "A buyer",
        reason: dispute.reason,
        disputeId: dispute.id,
      });
      sent++;
    } catch {
      // non-fatal, continue
    }
  }

  return NextResponse.json({ sent });
}
