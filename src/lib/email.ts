import { Resend } from "resend";
import { createHmac } from "crypto";
import { centsToDisplay } from "./stripe";

const FROM = "Plantet <noreply@plantet.shop>";

function getResend() {
  return new Resend(process.env.RESEND_API_KEY!);
}

function siteBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
}

// ─── Shared HTML helpers ─────────────────────────────────────────────────────

function emailBase({
  title,
  heading,
  subheading,
  body,
  footerNote = "You're receiving this because you have a Plantet account.",
  unsubLink,
}: {
  title: string;
  heading: string;
  subheading?: string;
  body: string;
  footerNote?: string;
  unsubLink?: string;
}): string {
  const year = new Date().getFullYear();
  const siteUrl = siteBase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F6F2E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E9;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F3;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(22,32,27,0.10);">

          <tr>
            <td style="background:linear-gradient(135deg,#1F4736 0%,#243E30 60%,#2F7D54 100%);padding:36px 32px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="28" height="28">
                      <g transform="translate(8 4)">
                        <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round"/>
                        <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                        <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
                      </g>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#F6F2E9;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Plantet</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#F6F2E9;font-size:26px;font-weight:700;line-height:1.25;">${heading}</h1>
              ${subheading ? `<p style="margin:0;color:#A8C19A;font-size:14px;font-weight:500;">${subheading}</p>` : ""}
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 40px;font-size:15px;color:#16201B;line-height:1.75;">
              ${body}
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#DED6C4;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#6B7E72;line-height:1.6;">${footerNote}</p>
              <p style="margin:0;font-size:12px;color:#6B7E72;">
                ${unsubLink ? `<a href="${unsubLink}" style="color:#6B7E72;text-decoration:underline;">Unsubscribe</a> &nbsp;&middot;&nbsp; ` : ""}<a href="${siteUrl}/privacy-policy" style="color:#6B7E72;text-decoration:underline;">Privacy Policy</a> &nbsp;&middot;&nbsp; &copy; ${year} Plantet
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function ctaBtn(label: string, href: string): string {
  return `<p style="text-align:center;margin:28px 0 0;"><a href="${href}" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">${label} &#8594;</a></p>`;
}

function infoCard(rows: { label: string; value: string }[]): string {
  const cells = rows
    .map(
      (r) => `<tr>
        <td style="padding:12px 20px;border-bottom:1px solid #DED6C4;">
          <p style="margin:0 0 2px;font-size:11px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#6B7E72;">${r.label}</p>
          <p style="margin:0;font-size:15px;font-weight:600;color:#16201B;">${r.value}</p>
        </td>
      </tr>`
    )
    .join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;margin:20px 0 24px;overflow:hidden;">${cells}</table>`;
}

// ─── Email confirmation (Supabase signup) ────────────────────────────────────
// confirmUrl: use "{{ .ConfirmationURL }}" when pasting into Supabase Auth → Email Templates

export function buildConfirmationEmailHtml({ confirmUrl }: { confirmUrl: string }): string {
  const siteUrl = siteBase();
  return emailBase({
    title: "Confirm your Plantet account",
    heading: "Confirm your email",
    subheading: "One click and you're in",
    body: `
      <p style="margin:0 0 20px;">Thanks for signing up! Click the button below to confirm your email address and activate your Plantet account.</p>
      ${ctaBtn("Confirm my account", confirmUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6B7E72;text-align:center;">This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.</p>
    `,
    footerNote: "You're receiving this because someone signed up for Plantet with this email address.",
  });
}

// ─── Password reset (Supabase auth) ─────────────────────────────────────────
// confirmUrl: use "{{ .ConfirmationURL }}" when pasting into Supabase Auth → Email Templates

export function buildPasswordResetHtml({ confirmUrl }: { confirmUrl: string }): string {
  return emailBase({
    title: "Reset your Plantet password",
    heading: "Reset your password",
    subheading: "We received a password reset request",
    body: `
      <p style="margin:0 0 20px;">Click the button below to choose a new password. This link expires in <strong>1 hour</strong>.</p>
      ${ctaBtn("Reset my password", confirmUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6B7E72;text-align:center;">If you didn't request a password reset you can safely ignore this email — your password won't be changed.</p>
    `,
    footerNote: "You're receiving this because a password reset was requested for your Plantet account.",
  });
}

// ─── Change email address (Supabase auth) ────────────────────────────────────
// confirmUrl: use "{{ .ConfirmationURL }}" when pasting into Supabase Auth → Email Templates

export function buildChangeEmailHtml({ confirmUrl }: { confirmUrl: string }): string {
  return emailBase({
    title: "Confirm your new Plantet email address",
    heading: "Confirm your new email",
    subheading: "One more step to update your account",
    body: `
      <p style="margin:0 0 20px;">You requested an email address change on your Plantet account. Click below to verify your new address and complete the update.</p>
      ${ctaBtn("Confirm new email", confirmUrl)}
      <p style="margin:24px 0 0;font-size:13px;color:#6B7E72;text-align:center;">If you didn't request this change, please ignore this email — your current email address will remain unchanged.</p>
    `,
    footerNote: "You're receiving this because an email address change was requested for your Plantet account.",
  });
}

// ─── Password changed notification ───────────────────────────────────────────

export function buildPasswordChangedHtml(): string {
  const siteUrl = siteBase();
  return emailBase({
    title: "Your Plantet password was changed",
    heading: "Password changed",
    subheading: "Your account security has been updated",
    body: `
      <p style="margin:0 0 20px;">This is a confirmation that the password for your Plantet account was successfully changed.</p>
      <p style="margin:0 0 20px;padding:16px 20px;background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;font-size:14px;color:#16201B;">If you made this change, no further action is needed. If you did <strong>not</strong> make this change, your account may be compromised — please reset your password immediately.</p>
      ${ctaBtn("Reset my password", `${siteUrl}/forgot-password`)}
    `,
    footerNote: "You're receiving this because your Plantet account password was recently changed.",
  });
}

// ─── Email address changed notification ──────────────────────────────────────

export function buildEmailChangedHtml({ newEmail }: { newEmail: string }): string {
  const siteUrl = siteBase();
  return emailBase({
    title: "Your Plantet email address was changed",
    heading: "Email address updated",
    subheading: "Your account email has been changed",
    body: `
      <p style="margin:0 0 20px;">This is a confirmation that the email address on your Plantet account was changed to <strong>${newEmail}</strong>.</p>
      <p style="margin:0 0 20px;padding:16px 20px;background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;font-size:14px;color:#16201B;">If you made this change, no further action is needed. If you did <strong>not</strong> make this change, please contact support immediately.</p>
      ${ctaBtn("Contact support", `${siteUrl}/support`)}
    `,
    footerNote: "You're receiving this because the email address on your Plantet account was recently changed.",
  });
}

// ─── Order delivered notification (buyer) ────────────────────────────────────

export function buildOrderDeliveredHtml({
  items,
  orderId,
}: {
  items: { name: string; quantity: number }[];
  orderId: string;
}): string {
  const siteUrl = siteBase();
  const infoRows = items.map((item, i) => ({
    label: items.length > 1 ? `Item ${i + 1}` : "Plant",
    value: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
  }));
  return emailBase({
    title: "Your order has arrived — Plantet",
    heading: "Your order has arrived!",
    subheading: "We hope everything looks great",
    body: `
      <p style="margin:0 0 16px;">Your seller has marked your order as delivered. We hope your plant${items.length !== 1 ? "s arrived" : " arrived"} in perfect shape!</p>
      ${infoCard(infoRows)}
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">You have 14 days to leave a review. Your feedback helps other buyers and supports great sellers.</p>
      ${ctaBtn("Leave a Review", `${siteUrl}/orders`)}
    `,
  });
}

export async function sendOrderDelivered({
  buyerEmail,
  items,
  orderId,
}: {
  buyerEmail: string;
  items: { name: string; quantity: number }[];
  orderId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: "Your order has arrived — Plantet",
    html: buildOrderDeliveredHtml({ items, orderId }),
  });
}

// ─── Oversell refund notification (buyer) ────────────────────────────────────

export function buildOversellRefundHtml({
  amountCents,
  items,
}: {
  amountCents: number;
  items: { name: string; quantity: number }[];
}): string {
  const siteUrl = siteBase();
  const infoRows = [
    ...items.map((item, i) => ({
      label: items.length > 1 ? `Item ${i + 1}` : "Plant",
      value: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
    })),
    { label: "Refund amount", value: centsToDisplay(amountCents) },
  ];
  return emailBase({
    title: "Your order has been refunded — Plantet",
    heading: "We're sorry — order refunded",
    subheading: "An item sold out just before your payment processed",
    body: `
      <p style="margin:0 0 16px;">We're really sorry about this. Due to two buyers purchasing the last available item at the same time, we weren't able to fulfill your order. Your payment has been <strong>fully refunded</strong> and you won't be charged anything.</p>
      ${infoCard(infoRows)}
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Refunds typically appear within 5–10 business days depending on your bank. We're sorry for the inconvenience — please check back as the seller may restock.</p>
      ${ctaBtn("Browse the Shop", `${siteUrl}/shop`)}
    `,
  });
}

export async function sendOversellRefund({
  buyerEmail,
  amountCents,
  items,
}: {
  buyerEmail: string;
  amountCents: number;
  items: { name: string; quantity: number }[];
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: "Your order has been refunded — Plantet",
    html: buildOversellRefundHtml({ amountCents, items }),
  });
}

// ─── Order confirmation (buyer) ──────────────────────────────────────────────

export function buildOrderConfirmationHtml({
  plantName,
  amountCents,
  orderId,
  items,
}: {
  plantName: string;
  amountCents: number;
  orderId: string;
  items?: { name: string; quantity: number }[];
}): string {
  const siteUrl = siteBase();
  const infoRows = items?.length
    ? [
        ...items.map((item, i) => ({
          label: items.length > 1 ? `Item ${i + 1}` : "Plant",
          value: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
        })),
        { label: "Total paid", value: centsToDisplay(amountCents) },
      ]
    : [
        { label: "Plant", value: plantName },
        { label: "Total paid", value: centsToDisplay(amountCents) },
      ];
  return emailBase({
    title: `Order confirmed — ${plantName}`,
    heading: "Your order is confirmed!",
    subheading: "Get ready — your plant is on its way",
    body: `
      <p style="margin:0 0 4px;">Thanks for your purchase! Here's a summary of your order.</p>
      ${infoCard(infoRows)}
      <p style="margin:0;font-size:14px;color:#6b7280;">Your seller will ship soon. We'll send another email when it's on the way.</p>
      ${ctaBtn("View Your Order", `${siteUrl}/orders/confirmed?id=${orderId}`)}
    `,
  });
}

export async function sendOrderConfirmation({
  buyerEmail,
  plantName,
  amountCents,
  orderId,
  items,
}: {
  buyerEmail: string;
  plantName: string;
  amountCents: number;
  orderId: string;
  items?: { name: string; quantity: number }[];
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Order confirmed — ${plantName}`,
    html: buildOrderConfirmationHtml({ plantName, amountCents, orderId, items }),
  });
}

// ─── Auction won (buyer/winner) ──────────────────────────────────────────────

export function buildAuctionWonHtml({
  plantName,
  amountCents,
  checkoutUrl,
}: {
  plantName: string;
  amountCents: number;
  checkoutUrl: string;
}): string {
  return emailBase({
    title: `You won the auction for ${plantName}!`,
    heading: "You won!",
    subheading: `Congratulations on your winning bid`,
    body: `
      <p style="margin:0 0 4px;">You won the auction for <strong>${plantName}</strong>. Complete your purchase within 48 hours to claim your plant.</p>
      ${infoCard([{ label: "Winning bid", value: centsToDisplay(amountCents) }])}
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">If you don't complete checkout within 48 hours, the auction may be re-listed.</p>
      ${ctaBtn("Complete Purchase", checkoutUrl)}
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
    subject: `You won the auction for ${plantName}!`,
    html: buildAuctionWonHtml({ plantName, amountCents, checkoutUrl }),
  });
}

// ─── Offer received (seller) ─────────────────────────────────────────────────

export function buildOfferReceivedHtml({
  sellerUsername,
  buyerUsername,
  plantName,
  amountCents,
  message,
}: {
  sellerUsername: string;
  buyerUsername: string;
  plantName: string;
  amountCents: number;
  message: string | null;
}): string {
  const siteUrl = siteBase();
  const messageRow = message
    ? `<p style="margin:16px 0 0;padding:14px 16px;background:#f0fdf4;border-left:3px solid #15803d;border-radius:0 6px 6px 0;font-size:14px;color:#374151;font-style:italic;">"${message}"</p>`
    : "";
  return emailBase({
    title: `New offer on your ${plantName}`,
    heading: "You have a new offer",
    subheading: `Someone wants to buy your ${plantName}`,
    body: `
      <p style="margin:0 0 4px;">Hi ${sellerUsername}, <strong>${buyerUsername}</strong> made an offer on your listing.</p>
      ${infoCard([
        { label: "Listing", value: plantName },
        { label: "Offer amount", value: centsToDisplay(amountCents) },
      ])}
      ${messageRow}
      <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Offers expire after 48 hours if not responded to.</p>
      ${ctaBtn("Accept or Decline", `${siteUrl}/dashboard/offers`)}
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
  offerId: _offerId,
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
    html: buildOfferReceivedHtml({ sellerUsername, buyerUsername, plantName, amountCents, message }),
  });
}

// ─── Offer accepted (buyer) ──────────────────────────────────────────────────

export function buildOfferAcceptedHtml({
  plantName,
  amountCents,
  checkoutUrl,
}: {
  plantName: string;
  amountCents: number;
  checkoutUrl: string;
}): string {
  return emailBase({
    title: `Your offer on ${plantName} was accepted!`,
    heading: "Your offer was accepted!",
    subheading: "Time to complete your purchase",
    body: `
      <p style="margin:0 0 4px;">Great news — the seller accepted your offer. Complete your purchase now to secure your plant.</p>
      ${infoCard([
        { label: "Plant", value: plantName },
        { label: "Offer amount", value: centsToDisplay(amountCents) },
      ])}
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">This offer expires in 48 hours.</p>
      ${ctaBtn("Complete Purchase", checkoutUrl)}
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
    subject: `Your offer on ${plantName} was accepted!`,
    html: buildOfferAcceptedHtml({ plantName, amountCents, checkoutUrl }),
  });
}

// ─── Offer declined (buyer) ──────────────────────────────────────────────────

export function buildOfferDeclinedHtml({
  plantName,
  listingUrl,
}: {
  plantName: string;
  listingUrl: string;
}): string {
  return emailBase({
    title: `Your offer on ${plantName} was declined`,
    heading: "Offer declined",
    subheading: "The seller passed on your offer this time",
    body: `
      <p style="margin:0 0 20px;">Unfortunately the seller declined your offer on <strong>${plantName}</strong>. You can still purchase at the listed price if it's still available.</p>
      ${ctaBtn("View Listing", listingUrl)}
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
    html: buildOfferDeclinedHtml({ plantName, listingUrl }),
  });
}

// ─── Restock notification (buyer/follower) ───────────────────────────────────

export function buildRestockNotificationHtml({
  plantName,
  listingUrl,
}: {
  plantName: string;
  listingUrl: string;
}): string {
  return emailBase({
    title: `${plantName} is back in stock!`,
    heading: "Back in stock!",
    subheading: `${plantName} is available again`,
    body: `
      <p style="margin:0 0 20px;">Good news — <strong>${plantName}</strong> is back in stock on Plantet. Stock is limited, so grab it before it's gone.</p>
      ${ctaBtn("Shop Now", listingUrl)}
    `,
    footerNote: "You're receiving this because you saved this item on Plantet.",
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
    subject: `${plantName} is back in stock!`,
    html: buildRestockNotificationHtml({ plantName, listingUrl }),
  });
}

// ─── Price drop alert (buyer/follower) ───────────────────────────────────────

export function buildPriceDropAlertHtml({
  plantName,
  regularCents,
  saleCents,
  listingUrl,
}: {
  plantName: string;
  regularCents: number;
  saleCents: number;
  listingUrl: string;
}): string {
  const priceLine = `<p style="margin:0;font-size:22px;font-weight:700;">
    <span style="text-decoration:line-through;color:#9ca3af;font-size:16px;">${centsToDisplay(regularCents)}</span>
    &nbsp;&#8594;&nbsp;
    <span style="color:#2F7D54;">${centsToDisplay(saleCents)}</span>
  </p>`;
  return emailBase({
    title: `Price drop on ${plantName}!`,
    heading: "Price drop alert!",
    subheading: `${plantName} you saved just went on sale`,
    body: `
      <p style="margin:0 0 16px;"><strong>${plantName}</strong> dropped in price. Don't miss it — sales are for a limited time.</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;margin:0 0 24px;">
        <tr><td style="padding:16px 20px;">${priceLine}</td></tr>
      </table>
      ${ctaBtn("Shop Now", listingUrl)}
    `,
    footerNote: "You're receiving this because you saved this item on Plantet.",
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
    subject: `Price drop on ${plantName} you saved!`,
    html: buildPriceDropAlertHtml({ plantName, regularCents, saleCents, listingUrl }),
  });
}

// ─── Auction ending soon (bidder/watcher) ────────────────────────────────────

export function buildAuctionEndingSoonHtml({
  plantName,
  auctionUrl,
  endsAt,
}: {
  plantName: string;
  auctionUrl: string;
  endsAt: string;
}): string {
  const timeLeft = new Date(endsAt).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return emailBase({
    title: `Auction ending soon: ${plantName}`,
    heading: "Auction ending soon!",
    subheading: `Don't miss your chance on ${plantName}`,
    body: `
      <p style="margin:0 0 16px;">The auction for <strong>${plantName}</strong> is closing soon.</p>
      ${infoCard([{ label: "Auction closes", value: timeLeft }])}
      ${ctaBtn("Place Your Bid", auctionUrl)}
    `,
    footerNote: "You're receiving this because you bid on or saved this auction.",
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
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `Auction ending soon: ${plantName}`,
    html: buildAuctionEndingSoonHtml({ plantName, auctionUrl, endsAt }),
  });
}

// ─── Outbid notification (bidder) ────────────────────────────────────────────

export function buildOutbidNotificationHtml({
  plantName,
  auctionId,
  newBidCents,
}: {
  plantName: string;
  auctionId: string;
  newBidCents: number;
}): string {
  const siteUrl = siteBase();
  return emailBase({
    title: `You've been outbid on ${plantName}`,
    heading: "You've been outbid",
    subheading: `Someone placed a higher bid on ${plantName}`,
    body: `
      <p style="margin:0 0 16px;">Head back to the auction to place a new bid before it closes.</p>
      ${infoCard([{ label: "Current highest bid", value: centsToDisplay(newBidCents) }])}
      ${ctaBtn("Place a New Bid", `${siteUrl}/auctions/${auctionId}`)}
    `,
    footerNote: "You're receiving this because you placed a bid on this auction.",
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
    html: buildOutbidNotificationHtml({ plantName, auctionId, newBidCents }),
  });
}

// ─── Auction cancelled (bidder) ──────────────────────────────────────────────

export function buildAuctionCancelledHtml({
  plantName,
}: {
  plantName: string;
  auctionId: string;
}): string {
  const siteUrl = siteBase();
  return emailBase({
    title: `Auction cancelled: ${plantName}`,
    heading: "Auction cancelled",
    subheading: "Your bid has been voided",
    body: `
      <p style="margin:0 0 20px;">The auction for <strong>${plantName}</strong> has been cancelled by the seller. Your bid has been voided and you will not be charged.</p>
      ${ctaBtn("Browse Other Auctions", `${siteUrl}/auctions`)}
    `,
  });
}

export async function sendAuctionCancelled({
  bidderEmail,
  plantName,
  auctionId,
}: {
  bidderEmail: string;
  plantName: string;
  auctionId: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: bidderEmail,
    subject: `Auction cancelled: ${plantName}`,
    html: buildAuctionCancelledHtml({ plantName, auctionId }),
  });
}

// ─── Auction ended — seller notification ─────────────────────────────────────

export async function sendAuctionEndedSeller({
  sellerEmail,
  plantName,
  winnerFound,
  winnerUsername,
  amountCents,
  ordersUrl,
}: {
  sellerEmail: string;
  plantName: string;
  winnerFound: boolean;
  winnerUsername?: string;
  amountCents?: number;
  ordersUrl: string;
}) {
  const siteUrl = siteBase();
  const resend = getResend();
  const html = winnerFound
    ? emailBase({
        title: `Your auction for ${plantName} ended`,
        heading: "Your auction ended — buyer is checking out",
        subheading: `${plantName}`,
        body: `
          <p style="margin:0 0 4px;"><strong>${winnerUsername}</strong> won your auction and has been sent a checkout link.</p>
          ${infoCard([
            { label: "Item", value: plantName },
            { label: "Winning bid", value: centsToDisplay(amountCents ?? 0) },
            { label: "Payment deadline", value: "48 hours from auction close" },
          ])}
          <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">You'll receive another notification once payment is confirmed. If the buyer doesn't pay within 48 hours you'll be able to offer to the next bidder or relist.</p>
          ${ctaBtn("View Your Orders", `${siteUrl}/orders?tab=sales`)}
        `,
      })
    : emailBase({
        title: `Your auction for ${plantName} ended with no bids`,
        heading: "Auction ended — no bids",
        subheading: `${plantName}`,
        body: `
          <p style="margin:0 0 20px;">Your auction for <strong>${plantName}</strong> ended without receiving any bids${amountCents ? ` that met the reserve price` : ""}. You can create a new auction or list it at a fixed price.</p>
          ${ctaBtn("Create New Auction", `${siteUrl}/dashboard/auctions`)}
        `,
      });
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: winnerFound ? `Your ${plantName} auction ended — buyer is checking out` : `Your ${plantName} auction ended with no bids`,
    html,
  });
}

// ─── Auction payment reminder (winner, 4 hours before deadline) ───────────────

export async function sendAuctionPaymentReminder({
  winnerEmail,
  plantName,
  checkoutUrl,
  deadlineAt,
}: {
  winnerEmail: string;
  plantName: string;
  checkoutUrl: string;
  deadlineAt: string;
}) {
  const resend = getResend();
  const deadline = new Date(deadlineAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  await resend.emails.send({
    from: FROM,
    to: winnerEmail,
    subject: `Reminder: complete your purchase of ${plantName} before it expires`,
    html: emailBase({
      title: `Payment reminder: ${plantName}`,
      heading: "Don't forget to complete your purchase",
      subheading: `Your checkout link expires soon`,
      body: `
        <p style="margin:0 0 4px;">You won the auction for <strong>${plantName}</strong>! Your payment deadline is approaching.</p>
        ${infoCard([
          { label: "Item", value: plantName },
          { label: "Payment deadline", value: deadline },
        ])}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">If you don't complete checkout by the deadline, the seller may offer the item to the next bidder.</p>
        ${ctaBtn("Complete Purchase Now", checkoutUrl)}
      `,
    }),
  });
}

// ─── Auction payment expired — seller notification ────────────────────────────

export async function sendAuctionPaymentExpired({
  sellerEmail,
  plantName,
  winnerUsername,
  winningBidCents,
  hasSecondBidder,
  offerUrl,
  auctionId,
}: {
  sellerEmail: string;
  plantName: string;
  winnerUsername: string;
  winningBidCents: number;
  hasSecondBidder: boolean;
  offerUrl: string;
  auctionId: string;
}) {
  const siteUrl = siteBase();
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Action needed: ${winnerUsername} didn't complete payment for ${plantName}`,
    html: emailBase({
      title: `Buyer didn't pay — ${plantName}`,
      heading: "Your buyer didn't complete payment",
      subheading: plantName,
      body: `
        <p style="margin:0 0 4px;"><strong>${winnerUsername}</strong> won your auction for <strong>${plantName}</strong> but did not complete payment within 48 hours.</p>
        ${infoCard([
          { label: "Item", value: plantName },
          { label: "Winning bid", value: centsToDisplay(winningBidCents) },
        ])}
        ${hasSecondBidder
          ? `<p style="margin:16px 0 8px;font-size:14px;">You can offer the item to the next highest bidder at <strong>their bid price</strong> (which may be lower than the winning bid), or relist the auction.</p>
             ${ctaBtn("View Options", offerUrl)}`
          : `<p style="margin:16px 0 8px;font-size:14px;">There were no other bidders. You can relist the auction when you're ready.</p>
             ${ctaBtn("Go to My Auctions", `${siteUrl}/dashboard/auctions`)}`
        }
      `,
    }),
  });
}

// ─── Second bidder offer ──────────────────────────────────────────────────────

export async function sendSecondBidderOffer({
  bidderEmail,
  plantName,
  bidCents,
  checkoutUrl,
  expiresAt,
}: {
  bidderEmail: string;
  plantName: string;
  bidCents: number;
  checkoutUrl: string;
  expiresAt: string;
}) {
  const resend = getResend();
  const deadline = new Date(expiresAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  await resend.emails.send({
    from: FROM,
    to: bidderEmail,
    subject: `Special offer: ${plantName} is available at your bid price`,
    html: emailBase({
      title: `${plantName} is available for you`,
      heading: "Good news — this plant is yours if you want it",
      subheading: plantName,
      body: `
        <p style="margin:0 0 4px;">The original auction winner didn't complete payment, and the seller has chosen to offer <strong>${plantName}</strong> to you at your bid price.</p>
        ${infoCard([
          { label: "Item", value: plantName },
          { label: "Your price", value: centsToDisplay(bidCents) },
          { label: "Offer expires", value: deadline },
        ])}
        <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">This offer is only available to you and expires in 24 hours. Complete checkout to secure your plant.</p>
        ${ctaBtn("Complete Purchase", checkoutUrl)}
      `,
    }),
  });
}

// ─── New order alert (seller) ────────────────────────────────────────────────

export function buildNewOrderAlertHtml({
  plantName,
  amountCents,
  orderId,
  buyerName,
  shippingAddress,
  items,
}: {
  plantName: string;
  amountCents: number;
  orderId: string;
  buyerName: string;
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string };
  items?: { name: string; quantity: number }[];
}): string {
  const siteUrl = siteBase();
  const addr = [
    shippingAddress.name,
    shippingAddress.line1,
    shippingAddress.line2,
    `${shippingAddress.city}, ${shippingAddress.state} ${shippingAddress.zip}`,
    shippingAddress.country,
  ]
    .filter(Boolean)
    .join("<br>");

  const infoRows = items?.length
    ? [
        ...items.map((item, i) => ({
          label: items.length > 1 ? `Item ${i + 1}` : "Plant",
          value: item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
        })),
        { label: "Sale amount", value: centsToDisplay(amountCents) },
      ]
    : [
        { label: "Plant", value: plantName },
        { label: "Sale amount", value: centsToDisplay(amountCents) },
      ];

  return emailBase({
    title: `New order: ${plantName}`,
    heading: "New order received!",
    subheading: `${buyerName} just bought from your shop`,
    body: `
      <p style="margin:0 0 4px;">You have a new order ready to ship.</p>
      ${infoCard(infoRows)}
      <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Ship to</p>
      <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.8;">${addr}</p>
      ${ctaBtn("View Order", `${siteUrl}/orders?tab=sales`)}
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
  items,
}: {
  sellerEmail: string;
  plantName: string;
  amountCents: number;
  orderId: string;
  buyerName: string;
  shippingAddress: { name: string; line1: string; line2?: string; city: string; state: string; zip: string; country: string };
  items?: { name: string; quantity: number }[];
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `New order: ${plantName}`,
    html: buildNewOrderAlertHtml({ plantName, amountCents, orderId, buyerName, shippingAddress, items }),
  });
}

// ─── Shipping notification (buyer) ───────────────────────────────────────────

export function buildShippingNotificationHtml({
  plantName,
  trackingNumber,
  orderId,
}: {
  plantName: string;
  trackingNumber: string;
  orderId: string;
}): string {
  const siteUrl = siteBase();
  return emailBase({
    title: `Your order has shipped — ${plantName}`,
    heading: "Your order has shipped!",
    subheading: "It's on its way",
    body: `
      <p style="margin:0 0 4px;">Great news — your seller has shipped your order.</p>
      ${infoCard([
        { label: "Plant", value: plantName },
        { label: "Tracking number", value: trackingNumber },
      ])}
      ${ctaBtn("View Your Order", `${siteUrl}/orders/confirmed?id=${orderId}`)}
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
    html: buildShippingNotificationHtml({ plantName, trackingNumber, orderId }),
  });
}

// ─── Low stock alert (seller) ────────────────────────────────────────────────

export function buildLowStockAlertHtml({
  plantName,
  variety,
  quantity,
}: {
  plantName: string;
  variety: string | null;
  quantity: number;
  inventoryId: string;
}): string {
  const siteUrl = siteBase();
  const name = variety ? `${plantName} — ${variety}` : plantName;
  return emailBase({
    title: `Low stock alert: ${name}`,
    heading: "Low stock alert",
    subheading: `Time to restock ${name}`,
    body: `
      <p style="margin:0 0 4px;">Your inventory is running low — restock soon to keep your shop active.</p>
      ${infoCard([
        { label: "Plant", value: name },
        { label: "Units remaining", value: `${quantity} unit${quantity !== 1 ? "s" : ""}` },
      ])}
      ${ctaBtn("Go to Inventory", `${siteUrl}/dashboard/inventory`)}
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
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Low stock alert: ${variety ? `${plantName} — ${variety}` : plantName}`,
    html: buildLowStockAlertHtml({ plantName, variety, quantity, inventoryId }),
  });
}

// ─── Welcome email ───────────────────────────────────────────────────────────

export function buildWelcomeHtml({ username }: { username: string }): string {
  const siteUrl = siteBase();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Plantet</title>
</head>
<body style="margin:0;padding:0;background:#F6F2E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E9;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F3;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(22,32,27,0.10);">

          <tr>
            <td style="background:linear-gradient(135deg,#1F4736 0%,#243E30 60%,#2F7D54 100%);padding:40px 32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="28" height="28">
                      <g transform="translate(8 4)">
                        <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round"/>
                        <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                        <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
                      </g>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#F6F2E9;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Plantet</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#F6F2E9;font-size:28px;font-weight:700;line-height:1.25;">Welcome to Plantet!</h1>
              <p style="margin:0;color:#A8C19A;font-size:14px;font-weight:500;">Your plant community is ready.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#16201B;">Hey ${username} &#128075;</p>
              <p style="margin:0;font-size:14px;color:#6B7E72;line-height:1.7;">You're now part of a community built for plant lovers — whether you're hunting for a rare find, growing your own collection, or looking to sell some cuttings. Here's everything you can do on Plantet.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#16201B;">What you can do</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#128722;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Shop &amp; Auctions</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Browse fixed-price listings or bid on live timed auctions from nurseries and collectors.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#129332;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Garden Log</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Track every plant you own — photos, care schedule, event history, and a shareable public garden.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#128172;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Community</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Ask for help, show off a plant you're proud of, or join a discussion with fellow growers.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#128227;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Follow Sellers</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Follow your favorite shops and get their new arrivals and restocks straight in your feed.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#128154;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Saved &amp; Wishlist</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Save listings and auctions you love. Build a plant wishlist of species you&apos;re hunting for.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">&#127873;</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1F4736;">Monthly Giveaway</p>
                        <p style="margin:0;font-size:12px;color:#6B7E72;line-height:1.5;">Every month we give away a plant prize. One entry per member — enter any time.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#FDF0EA;border:1px solid #EDCDC0;border-radius:10px;">
                      <tr><td style="padding:16px;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#C96B45;">For Buyers</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#7A3B25;line-height:1.6;">&#10004; Browse the shop and live auctions</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#7A3B25;line-height:1.6;">&#10004; Bid in real time with snipe protection</p>
                        <p style="margin:0;font-size:12px;color:#7A3B25;line-height:1.6;">&#10004; Track your plants in the garden log</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#EAF0EC;border:1px solid #8FA37E;border-radius:10px;">
                      <tr><td style="padding:16px;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#1F4736;">For Sellers</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#1F4736;line-height:1.6;">&#10004; Build a free public storefront</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#1F4736;line-height:1.6;">&#10004; List plants or run timed auctions</p>
                        <p style="margin:0;font-size:12px;color:#1F4736;line-height:1.6;">&#10004; Get paid directly via Stripe</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 40px;text-align:center;">
              <a href="${siteUrl}/account" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">Complete your profile &#8594;</a>
              <p style="margin:14px 0 0;font-size:12px;color:#6B7E72;">Add a photo, bio, and location so buyers and fellow plant lovers can find you.</p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#DED6C4;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#6B7E72;line-height:1.6;">You're receiving this because you created a Plantet account.</p>
              <p style="margin:0;font-size:12px;color:#6B7E72;">
                <a href="${siteUrl}/account" style="color:#6B7E72;text-decoration:underline;">Account settings</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6B7E72;text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                &copy; ${new Date().getFullYear()} Plantet
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWelcomeEmail({
  recipientEmail,
  username,
}: {
  recipientEmail: string;
  username: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: "Welcome to Plantet",
    html: buildWelcomeHtml({ username }),
  });
}

// ─── Weekly digest ─────────────────────────────────────────────────────────

export interface DigestListing {
  id: string;
  seller_id: string;
  plant_name: string;
  variety: string | null;
  price_cents: number;
  images: string[];
  seller_username: string;
}

export interface DigestAuction {
  id: string;
  plant_name: string;
  variety: string | null;
  current_bid_cents: number;
  ends_at: string;
  images: string[];
  bid_count: number;
  seller_username: string;
}

export function makeUnsubToken(userId: string): string {
  return createHmac("sha256", process.env.CRON_SECRET ?? "preview")
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

function unsubUrl(userId: string): string {
  const base = siteBase();
  return `${base}/api/unsubscribe?uid=${userId}&sig=${makeUnsubToken(userId)}`;
}

function plantCardHtml(listing: DigestListing, siteUrl: string): string {
  const img = listing.images?.[0];
  const name = listing.variety ? `${listing.plant_name} — ${listing.variety}` : listing.plant_name;
  return `
    <td width="33%" style="padding:0 8px 16px 0;vertical-align:top;">
      <a href="${siteUrl}/shop/${listing.id}" style="text-decoration:none;display:block;">
        ${img
          ? `<img src="${img}" width="168" height="150" alt="${listing.plant_name}" style="width:100%;height:150px;object-fit:cover;border-radius:10px;display:block;border:0;" />`
          : `<table width="100%" cellpadding="0" cellspacing="0"><tr><td height="150" style="height:150px;background:#EFE7D6;border-radius:10px;text-align:center;vertical-align:middle;font-size:32px;">&#127807;</td></tr></table>`}
        <p style="margin:8px 0 2px;font-size:13px;font-weight:600;color:#111827;line-height:1.3;">${name}</p>
        <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#2F7D54;">${centsToDisplay(listing.price_cents)}</p>
        <p style="margin:0;font-size:11px;color:#9ca3af;">by @${listing.seller_username}</p>
      </a>
    </td>`;
}

function listingSection(title: string, listings: DigestListing[], siteUrl: string): string {
  if (!listings.length) return "";
  const rows: string[] = [];
  for (let i = 0; i < listings.length; i += 3) {
    const group = listings.slice(i, i + 3);
    const cards = group.map((l) => plantCardHtml(l, siteUrl)).join("");
    const padding = group.length < 3
      ? Array(3 - group.length).fill('<td width="33%" style="padding:0;"></td>').join("")
      : "";
    rows.push(`<tr>${cards}${padding}</tr>`);
  }
  return `
    <tr>
      <td style="padding:0 32px 6px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">${title}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 28px;">
        <table width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>
      </td>
    </tr>`;
}

function auctionSection(auctions: DigestAuction[], siteUrl: string): string {
  if (!auctions.length) return "";
  const cards = auctions.map((a) => {
    const img = a.images?.[0];
    const name = a.variety ? `${a.plant_name} — ${a.variety}` : a.plant_name;
    const endsDate = new Date(a.ends_at);
    const hoursLeft = Math.max(0, Math.ceil((endsDate.getTime() - Date.now()) / 3_600_000));
    const timeLabel = hoursLeft < 24 ? `${hoursLeft}h left` : `${Math.ceil(hoursLeft / 24)}d left`;
    return `
      <tr>
        <td style="padding:0 32px 12px;">
          <a href="${siteUrl}/auctions/${a.id}" style="text-decoration:none;display:block;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                ${img
                  ? `<td width="100" style="vertical-align:top;">
                      <img src="${img}" width="100" height="100" alt="${a.plant_name}" style="width:100px;height:100px;object-fit:cover;display:block;border:0;" />
                    </td>`
                  : `<td width="100" height="100" style="width:100px;height:100px;background:#EFE7D6;text-align:center;vertical-align:middle;font-size:28px;">&#127807;</td>`}
                <td style="padding:12px 16px;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111827;">${name}</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#2F7D54;font-weight:700;">Current bid: ${centsToDisplay(a.current_bid_cents)}</p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">${a.bid_count} bid${a.bid_count !== 1 ? "s" : ""} &middot; ${timeLabel} &middot; by @${a.seller_username}</p>
                </td>
                <td style="padding:12px 16px;vertical-align:middle;text-align:right;">
                  <span style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:12px;font-weight:600;padding:8px 14px;border-radius:6px;white-space:nowrap;">Bid now &#8594;</span>
                </td>
              </tr>
            </table>
          </a>
        </td>
      </tr>`;
  }).join("");

  return `
    <tr>
      <td style="padding:0 32px 6px;">
        <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">&#128293; Hot auctions</p>
      </td>
    </tr>
    ${cards}
    <tr><td style="padding:0 0 12px;"></td></tr>`;
}

export function buildDigestHtml({
  username,
  userId,
  month,
  followedListings,
  freshListings,
  hotAuctions,
}: {
  username: string;
  userId: string;
  month: string;
  followedListings: DigestListing[];
  freshListings: DigestListing[];
  hotAuctions: DigestAuction[];
}): string {
  const siteUrl = siteBase();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your monthly plant digest — Plantet</title>
</head>
<body style="margin:0;padding:0;background:#F6F2E9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F6F2E9;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F3;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(22,32,27,0.10);">

          <tr>
            <td style="background:linear-gradient(135deg,#1F4736 0%,#243E30 60%,#2F7D54 100%);padding:40px 32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="28" height="28">
                      <g transform="translate(8 4)">
                        <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round"/>
                        <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                        <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
                      </g>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#F6F2E9;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Plantet</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#F6F2E9;font-size:26px;font-weight:700;line-height:1.25;">Your Weekly Plant Digest</h1>
              <p style="margin:0;color:#A8C19A;font-size:14px;font-weight:500;">${month}</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#16201B;">Hey ${username} &#128075;</p>
              <p style="margin:0;font-size:14px;color:#6B7E72;line-height:1.65;">Here's what's been growing this week on Plantet — fresh listings, new arrivals from shops you follow, and auctions you don't want to miss.</p>
            </td>
          </tr>

          ${listingSection("From shops you follow", followedListings, siteUrl)}
          ${listingSection("Fresh picks this week", freshListings, siteUrl)}
          ${auctionSection(hotAuctions, siteUrl)}

          <tr>
            <td style="padding:8px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#EFE7D6;border:1px solid #DED6C4;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:18px;">&#127873;</p>
                    <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#1F4736;">Monthly Giveaway</p>
                    <p style="margin:0 0 16px;font-size:13px;color:#2F7D54;line-height:1.6;">Enter for a chance to win this month's plant prize. One entry per member — entries reset each month.</p>
                    <a href="${siteUrl}/giveaway" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:7px;">Enter the giveaway &#8594;</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:8px 32px 40px;text-align:center;">
              <a href="${siteUrl}/shop" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">Browse the full shop &#8594;</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#DED6C4;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#6B7E72;line-height:1.6;">You're receiving this because you opted in to Plantet marketing emails.</p>
              <p style="margin:0;font-size:12px;color:#6B7E72;">
                <a href="${unsubUrl(userId)}" style="color:#6B7E72;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6B7E72;text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                &copy; ${new Date().getFullYear()} Plantet
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendWeeklyDigest({
  recipientEmail,
  username,
  userId,
  month,
  followedListings,
  freshListings,
  hotAuctions,
}: {
  recipientEmail: string;
  username: string;
  userId: string;
  month: string;
  followedListings: DigestListing[];
  freshListings: DigestListing[];
  hotAuctions: DigestAuction[];
}) {
  const resend = getResend();
  const html = buildDigestHtml({ username, userId, month, followedListings, freshListings, hotAuctions });
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Your weekly plant digest — ${month}`,
    html,
  });
}

// ─── Re-engagement email ────────────────────────────────────────────────────

export function buildReengagementHtml({
  username,
  userId,
  freshListings,
}: {
  username: string;
  userId: string;
  freshListings: DigestListing[];
}): string {
  const siteUrl = siteBase();
  const listingsHtml = freshListings.length ? listingSection("What's new on Plantet", freshListings, siteUrl) : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>We miss you — Plantet</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F3;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(22,32,27,0.10);">

          <tr>
            <td style="background:linear-gradient(135deg,#1F4736 0%,#243E30 60%,#2F7D54 100%);padding:40px 32px 36px;text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td style="vertical-align:middle;padding-right:8px;">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="28" height="28">
                      <g transform="translate(8 4)">
                        <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round"/>
                        <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                        <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
                      </g>
                    </svg>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#F6F2E9;font-size:20px;font-weight:700;letter-spacing:-0.02em;">Plantet</span>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0 0 8px;color:#F6F2E9;font-size:26px;font-weight:700;line-height:1.25;">We've missed you!</h1>
              <p style="margin:0;color:#A8C19A;font-size:14px;font-weight:500;">It's been a while — come see what's growing</p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#16201B;">Hey ${username} &#128075;</p>
              <p style="margin:0;font-size:14px;color:#6B7E72;line-height:1.65;">We noticed you haven't stopped by in a while. The shop has been growing — here are some fresh finds we think you'll love.</p>
            </td>
          </tr>

          ${listingsHtml}

          <tr>
            <td style="padding:8px 32px 40px;text-align:center;">
              <a href="${siteUrl}/shop" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">See what's new &#8594;</a>
            </td>
          </tr>

          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#DED6C4;"></div>
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#6B7E72;line-height:1.6;">You're receiving this because you opted in to Plantet marketing emails.</p>
              <p style="margin:0;font-size:12px;color:#6B7E72;">
                <a href="${unsubUrl(userId)}" style="color:#6B7E72;text-decoration:underline;">Unsubscribe</a>
                &nbsp;&middot;&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6B7E72;text-decoration:underline;">Privacy Policy</a>
                &nbsp;&middot;&nbsp;
                &copy; ${new Date().getFullYear()} Plantet
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendReengagementEmail({
  recipientEmail,
  username,
  userId,
  freshListings,
}: {
  recipientEmail: string;
  username: string;
  userId: string;
  freshListings: DigestListing[];
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: "We've missed you on Plantet",
    html: buildReengagementHtml({ username, userId, freshListings }),
  });
}

// ─── Garden care reminder ────────────────────────────────────────────────────

export function buildGardenCareReminderHtml({
  username,
  userId,
  month,
  items,
}: {
  username: string;
  userId: string;
  month: string;
  items: { plantName: string; careType: string; nextDueDate: string }[];
}): string {
  const siteUrl = siteBase();
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding:10px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${item.plantName}</td>
      <td style="padding:10px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${item.careType}</td>
      <td style="padding:10px 12px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${item.nextDueDate}</td>
    </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your garden care schedule — ${month}</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#FBF9F3;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(22,32,27,0.10);">

        <tr>
          <td style="background:linear-gradient(135deg,#1F4736 0%,#243E30 60%,#2F7D54 100%);padding:36px 32px;text-align:center;">
            <table cellpadding="0" cellspacing="0" style="margin:0 auto 12px;">
              <tr>
                <td style="vertical-align:middle;padding-right:8px;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" fill="none" width="26" height="26">
                    <g transform="translate(8 4)">
                      <path d="M40 82 C 40 66 40 56 40 46" stroke="#F6F2E9" stroke-width="6" stroke-linecap="round"/>
                      <g transform="translate(40 58) rotate(38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#A8C19A"/></g>
                      <g transform="translate(40 50) rotate(-38)"><path d="M0 0 C -15 -8 -15 -30 0 -44 C 15 -30 15 -8 0 0 Z" fill="#F6F2E9"/></g>
                    </g>
                  </svg>
                </td>
                <td style="vertical-align:middle;">
                  <span style="color:#F6F2E9;font-size:19px;font-weight:700;letter-spacing:-0.02em;">Plantet</span>
                </td>
              </tr>
            </table>
            <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;">Your Garden Care Schedule</h1>
            <p style="margin:0;color:#A8C19A;font-size:14px;">${month}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:#111827;">Hey ${username} &#128075;</p>
            <p style="margin:0;font-size:14px;color:#6B7E72;line-height:1.65;">Here's what your garden needs this month. Log each task directly from your garden page to keep your schedule on track.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6B7E72;text-transform:uppercase;letter-spacing:0.06em;">Plant</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Care</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Due by</th>
              </tr>
              ${rows}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 40px;text-align:center;">
            <a href="${siteUrl}/garden" style="display:inline-block;background:#2F7D54;color:#F6F2E9;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Open My Garden &#8594;</a>
          </td>
        </tr>

        <tr><td style="padding:0 32px;"><div style="height:1px;background:#DED6C4;"></div></td></tr>
        <tr>
          <td style="padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="${unsubUrl(userId)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
              &nbsp;&middot;&nbsp; &copy; ${new Date().getFullYear()} Plantet
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Auction auto-charged (buyer) ───────────────────────────────────────────

export async function sendAuctionAutoCharged({
  winnerEmail,
  plantName,
  amountCents,
  orderId,
  appUrl,
}: {
  winnerEmail: string;
  plantName: string;
  amountCents: number;
  orderId: string;
  appUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: winnerEmail,
    subject: `You won ${plantName} — payment confirmed!`,
    html: emailBase({
      title: `You won ${plantName}!`,
      heading: "Congratulations — you won!",
      subheading: "Your payment has been processed automatically",
      body: `
        <p style="margin:0 0 4px;">You won the auction for <strong>${plantName}</strong>. Your saved card has been charged and your order is confirmed.</p>
        ${infoCard([{ label: "Total charged", value: centsToDisplay(amountCents) }])}
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">The seller will be in touch with tracking information once your order ships.</p>
        ${ctaBtn("View Order", `${appUrl}/orders`)}
      `,
    }),
  });
}

// ─── Auction auto-charge failed (buyer) ──────────────────────────────────────

export async function sendAuctionPaymentFailed({
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
    subject: `Action required — payment failed for ${plantName}`,
    html: emailBase({
      title: `Payment failed for ${plantName}`,
      heading: "You won, but payment failed",
      subheading: "Please complete your purchase within 24 hours",
      body: `
        <p style="margin:0 0 4px;">You won the auction for <strong>${plantName}</strong>, but we were unable to charge your saved card automatically.</p>
        ${infoCard([{ label: "Amount due", value: centsToDisplay(amountCents) }])}
        <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">Please complete checkout within <strong>24 hours</strong> to claim your plant. If payment is not received, the auction may be offered to the next bidder.</p>
        ${ctaBtn("Complete Purchase", checkoutUrl)}
      `,
    }),
  });
}

// ─── Reserve offer accepted (buyer auto-charged) ─────────────────────────────

export function buildReserveOfferAcceptedHtml({
  plantName,
  amountCents,
  appUrl,
}: {
  plantName: string;
  amountCents: number;
  appUrl: string;
}): string {
  return emailBase({
    title: `Purchase confirmed — ${plantName}`,
    heading: "Purchase confirmed!",
    subheading: "Your card has been charged",
    body: `
      <p style="margin:0 0 4px;">You accepted the seller's reserve offer for <strong>${plantName}</strong>. Your saved payment method has been charged and your order is confirmed.</p>
      ${infoCard([{ label: "Total charged", value: centsToDisplay(amountCents) }])}
      <p style="margin:0 0 24px;font-size:14px;color:#6b7280;">The seller will be in touch with tracking information once your order ships.</p>
      ${ctaBtn("View Order", `${appUrl}/orders`)}
    `,
  });
}

export async function sendReserveOfferAccepted({
  buyerEmail,
  plantName,
  amountCents,
  appUrl,
}: {
  buyerEmail: string;
  plantName: string;
  amountCents: number;
  appUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `Purchase confirmed — ${plantName}`,
    html: buildReserveOfferAcceptedHtml({ plantName, amountCents, appUrl }),
  });
}

// ─── Reserve offer: seller accepts below-reserve bid ─────────────────────────

export function buildReserveOfferToBuyerHtml({
  plantName,
  bidCents,
  shippingLabel,
  offerUrl,
  expiresAt,
}: {
  plantName: string;
  bidCents: number;
  shippingLabel: string;
  offerUrl: string;
  expiresAt: string;
}): string {
  const deadline = new Date(expiresAt).toLocaleString("en-US", { month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  return emailBase({
    title: `The seller accepted your bid on ${plantName}`,
    heading: "Great news — the seller said yes!",
    subheading: plantName,
    body: `
      <p style="margin:0 0 4px;">Your bid didn't meet the original reserve, but the seller has decided to accept it anyway. Confirm your purchase before the offer expires.</p>
      ${infoCard([
        { label: "Item", value: plantName },
        { label: "Your bid", value: centsToDisplay(bidCents) },
        { label: "Shipping", value: shippingLabel },
        { label: "Offer expires", value: deadline },
      ])}
      <p style="margin:16px 0 0;font-size:14px;color:#6b7280;">Your saved payment method will be charged when you confirm. This offer expires in 48 hours.</p>
      ${ctaBtn("Confirm Purchase", offerUrl)}
    `,
  });
}

export async function sendReserveOfferToBuyer({
  buyerEmail,
  plantName,
  bidCents,
  shippingLabel,
  offerUrl,
  expiresAt,
}: {
  buyerEmail: string;
  plantName: string;
  bidCents: number;
  shippingLabel: string;
  offerUrl: string;
  expiresAt: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: buyerEmail,
    subject: `The seller accepted your bid on ${plantName}`,
    html: buildReserveOfferToBuyerHtml({ plantName, bidCents, shippingLabel, offerUrl, expiresAt }),
  });
}

export function buildReserveOfferDeclinedHtml({
  plantName,
  buyerUsername,
  bidCents,
  dashboardUrl,
}: {
  plantName: string;
  buyerUsername: string;
  bidCents: number;
  dashboardUrl: string;
}): string {
  return emailBase({
    title: `Reserve offer declined — ${plantName}`,
    heading: "The buyer declined your offer",
    subheading: plantName,
    body: `
      <p style="margin:0 0 4px;"><strong>${buyerUsername}</strong> declined your reserve offer. You can relist the item or try a different approach.</p>
      ${infoCard([
        { label: "Item", value: plantName },
        { label: "Declined bid", value: centsToDisplay(bidCents) },
      ])}
      ${ctaBtn("Go to Your Auctions", dashboardUrl)}
    `,
  });
}

export async function sendReserveOfferDeclined({
  sellerEmail,
  plantName,
  buyerUsername,
  bidCents,
  dashboardUrl,
}: {
  sellerEmail: string;
  plantName: string;
  buyerUsername: string;
  bidCents: number;
  dashboardUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Your reserve offer for ${plantName} was declined`,
    html: buildReserveOfferDeclinedHtml({ plantName, buyerUsername, bidCents, dashboardUrl }),
  });
}

export async function sendReserveOfferExpired({
  sellerEmail,
  plantName,
  bidCents,
  dashboardUrl,
}: {
  sellerEmail: string;
  plantName: string;
  bidCents: number;
  dashboardUrl: string;
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: sellerEmail,
    subject: `Your reserve offer for ${plantName} expired`,
    html: buildReserveOfferExpiredHtml({ plantName, bidCents, dashboardUrl }),
  });
}

export function buildReserveOfferExpiredHtml({
  plantName,
  bidCents,
  dashboardUrl,
}: {
  plantName: string;
  bidCents: number;
  dashboardUrl: string;
}): string {
  return emailBase({
    title: `Reserve offer expired — ${plantName}`,
    heading: "Your reserve offer expired",
    subheading: plantName,
    body: `
      <p style="margin:0 0 4px;">The buyer didn't respond to your reserve offer within 48 hours. You can relist the item or create a new auction.</p>
      ${infoCard([
        { label: "Item", value: plantName },
        { label: "Offered bid", value: centsToDisplay(bidCents) },
      ])}
      ${ctaBtn("Go to Your Auctions", dashboardUrl)}
    `,
  });
}

// ─── Garden care reminder ─────────────────────────────────────────────────────

export async function sendGardenCareReminder({
  recipientEmail,
  username,
  userId,
  month,
  items,
}: {
  recipientEmail: string;
  username: string;
  userId: string;
  month: string;
  items: { plantName: string; careType: string; nextDueDate: string }[];
}) {
  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `Your garden care schedule for ${month}`,
    html: buildGardenCareReminderHtml({ username, userId, month, items }),
  });
}
