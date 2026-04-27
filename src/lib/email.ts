import { Resend } from "resend";
import { centsToDisplay } from "./stripe";

const FROM = "Plantet <noreply@plantet.co>";

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
