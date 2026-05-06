import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { plan, billing } = await request.json() as { plan: "grower" | "nursery"; billing: "monthly" | "annual" };

  // Read at request time so env vars are always current
  const PRICE_IDS: Record<string, Record<string, string | undefined>> = {
    grower:  { monthly: process.env.STRIPE_GROWER_PRICE_ID,  annual: process.env.STRIPE_GROWER_ANNUAL_PRICE_ID },
    nursery: { monthly: process.env.STRIPE_NURSERY_PRICE_ID, annual: process.env.STRIPE_NURSERY_ANNUAL_PRICE_ID },
  };

  const priceId = PRICE_IDS[plan]?.[billing];
  if (!priceId) {
    const missing = `STRIPE_${plan.toUpperCase()}_${billing === "annual" ? "ANNUAL_" : ""}PRICE_ID`;
    return NextResponse.json({ error: `Stripe price not configured. Set the ${missing} environment variable.` }, { status: 400 });
  }

  const admin = createAdmin(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await admin.from("profiles").select("stripe_customer_id, stripe_subscription_id, plan").eq("id", user.id).single();
  const { data: { user: authUser } } = await admin.auth.admin.getUserById(user.id);

  const stripe = getStripe();
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");

  try {
    // If already on a paid plan, send them to the portal to change
    if (profile?.stripe_subscription_id) {
      const session = await stripe.billingPortal.sessions.create({
        customer: profile.stripe_customer_id!,
        return_url: `${appUrl}/account`,
      });
      return NextResponse.json({ url: session.url });
    }

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: authUser?.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await admin.from("profiles").update({ stripe_customer_id: customerId }).eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/account?subscription=success`,
      cancel_url: `${appUrl}/account?subscription=cancelled`,
      metadata: { supabase_user_id: user.id, plan, billing },
      subscription_data: { metadata: { supabase_user_id: user.id, plan } },
      automatic_tax: { enabled: true },
      customer_update: { address: "auto" },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    console.error("[subscribe]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
