import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();

  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id;
  if (!customerId) {
    const { data: authUser } = await admin.auth.admin.getUserById(user.id);
    const customer = await getStripe().customers.create({
      email: authUser?.user?.email,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "setup",
      customer: customerId,
      currency: "usd",
      success_url: `${appUrl}/api/stripe/setup-session/complete?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/account#bidding`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create setup session";
    console.error("[setup-session]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
