import { NextResponse } from "next/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

function adminClient() {
  return createSupabaseAdmin<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Shippo sends a X-Shippo-Webhook-Signature header for verification.
// We validate using HMAC-SHA256 against SHIPPO_WEBHOOK_SECRET.
async function verifySignature(body: string, header: string | null): Promise<boolean> {
  const secret = process.env.SHIPPO_WEBHOOK_SECRET;
  if (!secret) return true; // dev: skip verification if secret not set
  if (!header) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === header;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-shippo-webhook-signature");

  if (!await verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event as string | undefined;
  const eventId = event.id as string | undefined;

  // Shippo fires "transaction_updated" when a postage adjustment is applied.
  // The data object contains the transaction with billing adjustment details.
  if (eventType !== "transaction_updated") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const data = event.data as Record<string, unknown> | undefined;
  if (!data) return NextResponse.json({ ok: true });

  // A postage adjustment shows up as a transaction with object_status "SUCCESS"
  // and a non-null "adjustment" field containing the extra charge.
  const adjustment = data.adjustment as Record<string, unknown> | null | undefined;
  if (!adjustment) return NextResponse.json({ ok: true, skipped: "no adjustment" });

  const amountStr = adjustment.amount as string | undefined;
  const adjustmentCents = amountStr ? Math.round(parseFloat(amountStr) * 100) : 0;
  if (adjustmentCents <= 0) return NextResponse.json({ ok: true, skipped: "zero adjustment" });

  const shippoTransactionId = data.object_id as string | undefined;

  const admin = adminClient();

  // Look up the order by shippo_transaction_id
  const { data: order } = await admin
    .from("orders")
    .select("id, seller_id")
    .eq("shippo_transaction_id", shippoTransactionId ?? "")
    .maybeSingle();

  // Extract weight info if available
  const parcel = data.parcel as Record<string, unknown> | undefined;
  const billedWeightOz = parcel?.weight ? parseFloat(parcel.weight as string) : null;

  // Insert adjustment record (idempotent via shippo_event_id unique constraint)
  const { error } = await admin.from("shipping_adjustments").insert({
    order_id: order?.id ?? null,
    seller_id: order?.seller_id ?? null,
    shippo_transaction_id: shippoTransactionId ?? null,
    billed_weight_oz: billedWeightOz,
    adjustment_cents: adjustmentCents,
    shippo_event_id: eventId ?? null,
  });

  if (error && error.code !== "23505") { // 23505 = unique violation (already processed)
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, adjustmentCents });
}
