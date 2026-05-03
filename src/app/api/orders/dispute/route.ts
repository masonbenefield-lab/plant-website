import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, reason, details } = await request.json() as {
    orderId: string;
    reason: string;
    details: string;
  };

  if (!orderId || !reason) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify this order belongs to the buyer
  const { data: order } = await supabase
    .from("orders")
    .select("id, seller_id, amount_cents, status, listing_id, auction_id")
    .eq("id", orderId)
    .eq("buyer_id", user.id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Create a report against the seller
  await supabase.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: order.seller_id,
    reason: `Order problem: ${reason}`,
    details: details ? `Order ID: ${orderId}\n\n${details}` : `Order ID: ${orderId}`,
    status: "open",
  });

  // Send admin email
  try {
    const resend = new Resend(process.env.RESEND_API_KEY!);
    await resend.emails.send({
      from: "Plantet <noreply@plantet.shop>",
      to: "masonbenefield@gmail.com",
      subject: `Order dispute filed — ${reason}`,
      html: `
        <p><strong>Buyer ID:</strong> ${user.id}</p>
        <p><strong>Order ID:</strong> ${orderId}</p>
        <p><strong>Seller ID:</strong> ${order.seller_id}</p>
        <p><strong>Order status:</strong> ${order.status}</p>
        <p><strong>Amount:</strong> $${(order.amount_cents / 100).toFixed(2)}</p>
        <p><strong>Reason:</strong> ${reason}</p>
        ${details ? `<p><strong>Details:</strong><br>${details.replace(/\n/g, "<br>")}</p>` : ""}
        <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/reports">View in admin →</a></p>
      `,
    });
  } catch {
    // Email failure shouldn't block the response — report was already saved
  }

  return NextResponse.json({ ok: true });
}
