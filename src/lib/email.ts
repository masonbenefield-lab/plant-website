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
