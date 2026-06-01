import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { getStripe } from "@/lib/stripe";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as {
    paymentMethodId?: string;
    shippingAddress?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    };
  };

  const admin = adminClient();
  const update: Record<string, unknown> = {};

  if (body.paymentMethodId) {
    const { data: profile } = await admin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: "No Stripe customer found" }, { status: 400 });
    }

    await getStripe().paymentMethods.attach(body.paymentMethodId, {
      customer: profile.stripe_customer_id,
    });
    await getStripe().customers.update(profile.stripe_customer_id, {
      invoice_settings: { default_payment_method: body.paymentMethodId },
    });

    update.default_payment_method_id = body.paymentMethodId;
  }

  if (body.shippingAddress) {
    const { name, line1, city, state, zip, country } = body.shippingAddress;
    if (!name || !line1 || !city || !state || !zip || !country) {
      return NextResponse.json({ error: "Missing required address fields" }, { status: 400 });
    }
    update.saved_shipping_address = body.shippingAddress;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await admin.from("profiles").update(update as Database["public"]["Tables"]["profiles"]["Update"]).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, default_payment_method_id, saved_shipping_address")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id || !profile?.default_payment_method_id) {
    return NextResponse.json({ card: null, shippingAddress: profile?.saved_shipping_address ?? null });
  }

  try {
    const pm = await getStripe().paymentMethods.retrieve(profile.default_payment_method_id);
    return NextResponse.json({
      card: pm.card ? {
        brand: pm.card.brand,
        last4: pm.card.last4,
        expMonth: pm.card.exp_month,
        expYear: pm.card.exp_year,
      } : null,
      shippingAddress: profile.saved_shipping_address ?? null,
    });
  } catch {
    return NextResponse.json({ card: null, shippingAddress: profile.saved_shipping_address ?? null });
  }
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = adminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, default_payment_method_id")
    .eq("id", user.id)
    .single();

  if (profile?.default_payment_method_id) {
    await getStripe().paymentMethods.detach(profile.default_payment_method_id).catch(() => {});
    await admin.from("profiles").update({ default_payment_method_id: null }).eq("id", user.id);
  }

  return NextResponse.json({ ok: true });
}
