import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

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

  const { orderId } = await request.json() as { orderId: string };
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const admin = adminClient();
  const { data: order } = await admin
    .from("orders")
    .select("id, buyer_id, status")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  if (order.status !== "shipped") {
    return NextResponse.json({ error: "Order is not in shipped status" }, { status: 400 });
  }

  const { error } = await admin
    .from("orders")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", orderId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
