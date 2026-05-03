import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createAdminClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Block if seller has live auctions
  const { data: liveAuctions } = await supabase
    .from("auctions")
    .select("id")
    .eq("seller_id", user.id)
    .eq("status", "active")
    .limit(1);

  if (liveAuctions && liveAuctions.length > 0) {
    return NextResponse.json({
      error: "You have active auctions. End or cancel all auctions before deleting your account.",
    }, { status: 400 });
  }

  // Block if seller has orders that haven't shipped yet
  const { data: pendingOrders } = await supabase
    .from("orders")
    .select("id")
    .eq("seller_id", user.id)
    .in("status", ["pending", "paid"])
    .limit(1);

  if (pendingOrders && pendingOrders.length > 0) {
    return NextResponse.json({
      error: "You have orders that haven't shipped yet. Fulfill all pending orders before deleting your account.",
    }, { status: 400 });
  }

  const service = adminClient();
  const { error } = await service.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
