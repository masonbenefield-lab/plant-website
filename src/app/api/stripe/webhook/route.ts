import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature")!;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = adminClient();

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("stripe_payment_intent_id", pi.id);
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object;
    await supabase
      .from("orders")
      .delete()
      .eq("stripe_payment_intent_id", pi.id)
      .eq("status", "pending");
  }

  return NextResponse.json({ received: true });
}
