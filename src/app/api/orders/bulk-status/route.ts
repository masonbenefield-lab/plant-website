import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/supabase/types";

const VALID_STATUSES: OrderStatus[] = ["pending", "paid", "shipped", "delivered"];

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderIds, status } = await request.json() as { orderIds: string[]; status: OrderStatus };

  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return NextResponse.json({ error: "No orders selected" }, { status: 400 });
  }
  if (orderIds.length > 50) {
    return NextResponse.json({ error: "Too many orders in one request" }, { status: 400 });
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
