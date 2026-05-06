import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types";

const VALID_STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("plan, is_admin").eq("id", user.id).single();
  const plan = profile?.plan ?? "seedling";
  const isAdmin = !!(profile as { is_admin?: boolean } | null)?.is_admin;

  if (!isAdmin && plan === "seedling") {
    return NextResponse.json({ error: "Bulk order updates require a Grower or Nursery plan." }, { status: 403 });
  }

  // Grower: up to 50 orders; Nursery+admin: up to 200
  const batchLimit = isAdmin || plan === "nursery" ? 200 : 50;

  const { orderIds, status } = await request.json() as { orderIds: string[]; status: OrderStatus };

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }
  if (orderIds.length > batchLimit) {
    return NextResponse.json({ error: `Too many orders — your plan allows up to ${batchLimit} at once.` }, { status: 400 });
  }
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("orders")
    .update({ status })
    .in("id", orderIds)
    .eq("seller_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: orderIds.length });
}
