import { NextResponse } from "next/server";
import { createClient as createAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStripe } from "@/lib/stripe";
import type Stripe from "stripe";

function adminClient() {
  return createAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session_id");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  const returnUrl = `${appUrl}/account#bidding`;

  if (!sessionId) return NextResponse.redirect(returnUrl);

  try {
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ["setup_intent"],
    });

    const setupIntent = session.setup_intent as Stripe.SetupIntent | null;
    const paymentMethodId =
      typeof setupIntent?.payment_method === "string"
        ? setupIntent.payment_method
        : (setupIntent?.payment_method as Stripe.PaymentMethod | null)?.id;

    const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;

    if (paymentMethodId && customerId) {
      const admin = adminClient();
      await admin
        .from("profiles")
        .update({ default_payment_method_id: paymentMethodId })
        .eq("stripe_customer_id", customerId);
    }
  } catch (err) {
    console.error("[setup-session/complete]", err);
  }

  return NextResponse.redirect(returnUrl);
}
