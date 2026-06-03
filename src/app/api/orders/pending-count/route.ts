import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ buyerPending: 0, sellerPending: 0 });

  const [{ count: buyerCount }, { count: sellerCount }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("buyer_id", user.id)
      .eq("status", "pending")
      .not("payment_deadline_at", "is", null)
      .gt("payment_deadline_at", new Date().toISOString()),
    supabase.from("orders").select("id", { count: "exact", head: true })
      .eq("seller_id", user.id)
      .eq("status", "paid"),
  ]);

  return NextResponse.json({ buyerPending: buyerCount ?? 0, sellerPending: sellerCount ?? 0 });
}
