import { Resend } from "resend";
import { centsToDisplay } from "./stripe";

const FROM = "Plantet <noreply@plantet.shop>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

export async function sendOrderConfirmation({
  buyerEmail,
  plantName,
  amountCents,
  orderId,
}: {
  buyerEmail: string;
  plantName: string;
  amountCents: number;
  orderId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Order confirmed — ${plantName}`,
    html: `
      <p>Thanks for your purchase!</p>
      <p><strong>${plantName}</strong> — ${centsToDisplay(amountCents)}</p>
      <p>Your seller will ship your order soon. You can track its status at:</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/confirmed?id=${orderId}">View your order</a></p>
    `,
  });
}

export async function sendAuctionWon({
  winnerEmail,
  plantName,
  amountCents,
  checkoutUrl,
}: {
  winnerEmail: string;
  plantName: string;
  amountCents: number;
  checkoutUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: winnerEmail,
    subject: `🎉 You won the auction for ${plantName}!`,
    html: `
      <p>Congratulations — you won the auction for <strong>${plantName}</strong>!</p>
      <p>Your winning bid: <strong>${centsToDisplay(amountCents)}</strong></p>
      <p>Complete your purchase within 48 hours to claim your plant:</p>
      <p><a href="${checkoutUrl}" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Complete Purchase</a></p>
      <p style="color:#888;font-size:12px;">If you don't complete checkout within 48 hours, the auction may be re-listed.</p>
    `,
  });
}

export async function sendOfferReceived({
  sellerEmail,
  sellerUsername,
  buyerUsername,
  plantName,
  amountCents,
  message,
  offerId,
}: {
  sellerEmail: string;
  sellerUsername: string;
  buyerUsername: string;
  plantName: string;
  amountCents: number;
  message: string | null;
  offerId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `New offer on your ${plantName}`,
    html: `
      <p>Hi ${sellerUsername},</p>
      <p><strong>${buyerUsername}</strong> made an offer of <strong>${centsToDisplay(amountCents)}</strong> on your <strong>${plantName}</strong>.</p>
      ${message ? `<p>Their message: <em>"${message}"</em></p>` : ""}
      <p>Accept or decline from your offers dashboard:</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/offers" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">View Offer</a></p>
      <p style="color:#888;font-size:12px;">Offers expire after 48 hours if not responded to.</p>
    `,
  });
}

export async function sendOfferAccepted({
  buyerEmail,
  plantName,
  amountCents,
  checkoutUrl,
}: {
  buyerEmail: string;
  plantName: string;
  amountCents: number;
  checkoutUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Your offer on ${plantName} was accepted! 🌿`,
    html: `
      <p>Great news — the seller accepted your offer of <strong>${centsToDisplay(amountCents)}</strong> for <strong>${plantName}</strong>!</p>
      <p>Complete your purchase now to secure your plant:</p>
      <p><a href="${checkoutUrl}" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Complete Purchase</a></p>
      <p style="color:#888;font-size:12px;">This offer expires in 48 hours.</p>
    `,
  });
}

export async function sendOfferDeclined({
  buyerEmail,
  plantName,
  listingUrl,
}: {
  buyerEmail: string;
  plantName: string;
  listingUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Your offer on ${plantName} was declined`,
    html: `
      <p>Unfortunately, the seller declined your offer on <strong>${plantName}</strong>.</p>
      <p>You can still purchase at the listed price:</p>
      <p><a href="${listingUrl}">View listing →</a></p>
    `,
  });
}

export async function sendRestockNotification({
  email,
  plantName,
  listingUrl,
}: {
  email: string;
  plantName: string;
  listingUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${plantName} is back in stock! 🌱`,
    html: `
      <p>Good news — <strong>${plantName}</strong> is back in stock on Plantet!</p>
      <p><a href="${listingUrl}" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Shop Now</a></p>
      <p style="color:#888;font-size:12px;">Stock is limited — grab it before it's gone.</p>
    `,
  });
}

export async function sendPriceDropAlert({
  email,
  plantName,
  regularCents,
  saleCents,
  listingUrl,
}: {
  email: string;
  plantName: string;
  regularCents: number;
  saleCents: number;
  listingUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Price drop on ${plantName} you wishlisted!`,
    html: `
      <p>Great news — <strong>${plantName}</strong> from your wishlist just went on sale!</p>
      <p>
        <span style="text-decoration:line-through;color:#888">${centsToDisplay(regularCents)}</span>
        &nbsp;→&nbsp;
        <strong style="color:#15803d">${centsToDisplay(saleCents)}</strong>
      </p>
      <p><a href="${listingUrl}" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Shop Now</a></p>
      <p style="color:#888;font-size:12px;">Sale is for a limited time — don't miss it.</p>
    `,
  });
}

export async function sendAuctionEndingSoon({
  email,
  plantName,
  auctionUrl,
  endsAt,
}: {
  email: string;
  plantName: string;
  auctionUrl: string;
  endsAt: string;
}) {
  const resend = getResend();
  const timeLeft = new Date(endsAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `⏰ Auction ending soon: ${plantName}`,
    html: `
      <p>The auction for <strong>${plantName}</strong> is ending soon — closes ${timeLeft}.</p>
      <p>Don't miss your chance to win!</p>
      <p><a href="${auctionUrl}" style="display:inline-block;padding:10px 20px;background:#15803d;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold;">Place Your Bid</a></p>
    `,
  });
}

export async function sendOutbidNotification({
  bidderEmail,
  plantName,
  auctionId,
  newBidCents,
}: {
  bidderEmail: string;
  plantName: string;
  auctionId: string;
  newBidCents: number;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: bidderEmail,
    subject: `You've been outbid on ${plantName}`,
    html: `
      <p>Someone placed a higher bid of <strong>${centsToDisplay(newBidCents)}</strong> on <strong>${plantName}</strong>.</p>
      <p>Head back to place a new bid before the auction ends:</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/auctions/${auctionId}">View auction</a></p>
    `,
  });
}

export async function sendNewOrderAlert({
  sellerEmail,
  plantName,
  amountCents,
  orderId,
  buyerName,
  shippingAddress,
}: {
  sellerEmail: string;
  plantName: string;
  amountCents: number;
  orderId: string;
  buyerName: string;
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string };
}) {
  const resend = getResend();
  const addr = [
    shippingAddress.name,
    shippingAddress.line1,
    shippingAddress.line2,
    `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`,
    shippingAddress.country,
  ].filter(Boolean).join("<br>");

  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `New order: ${plantName}`,
    html: `
      <p>You have a new order!</p>
      <p><strong>${plantName}</strong> — ${centsToDisplay(amountCents)}</p>
      <p><strong>Ship to:</strong><br>${addr}</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/orders">View order in your dashboard</a></p>
    `,
  });
}

export async function sendShippingNotification({
  buyerEmail,
  plantName,
  trackingNumber,
  orderId,
}: {
  buyerEmail: string;
  plantName: string;
  trackingNumber: string;
  orderId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Your order has shipped — ${plantName}`,
    html: `
      <p>Great news — your order has shipped!</p>
      <p><strong>${plantName}</strong></p>
      <p>Tracking number: <strong>${trackingNumber}</strong></p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/orders/confirmed?id=${orderId}">View your order</a></p>
    `,
  });
}

export async function sendLowStockAlert({
  sellerEmail,
  plantName,
  variety,
  quantity,
  inventoryId,
}: {
  sellerEmail: string;
  plantName: string;
  variety: string | null;
  quantity: number;
  inventoryId: string;
}) {
  const resend = getResend();
  const name = variety ? `${plantName} — ${variety}` : plantName;
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Low stock alert: ${name}`,
    html: `
      <p>Your stock for <strong>${name}</strong> has dropped to <strong>${quantity} unit${quantity !== 1 ? "s" : ""}</strong>.</p>
      <p>Head to your inventory to restock:</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/inventory">View inventory</a></p>
    `,
  });
}
