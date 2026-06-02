import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { sendDisputeResolvedToBuyer } from "@/lib/email";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: dispute } = await supabase
    .from("order_disputes")
    .select("id, buyer_id, seller_id, status")
    .eq("id", id)
    .eq("seller_id", user.id)
    .single();

  if (!dispute) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  if (dispute.status === "resolved") return NextResponse.json({ error: "Already resolved" }, { status: 400 });

  const { error } = await supabase
    .from("order_disputes")
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Notify buyer
  try {
    const admin = adminClient();
    const [{ data: sellerProfile }, { data: buyerAuthData }] = await Promise.all([
      supabase.from("profiles").select("username").eq("id", user.id).single(),
      admin.auth.admin.getUserById(dispute.buyer_id),
    ]);
    const buyerEmail = buyerAuthData?.user?.email;
    if (buyerEmail) {
      await sendDisputeResolvedToBuyer({
        buyerEmail,
        sellerUsername: sellerProfile?.username ?? "The seller",
      }).catch(() => {});
    }
  } catch {
    // non-fatal
  }

  return NextResponse.json({ ok: true });
}
