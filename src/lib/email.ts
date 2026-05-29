import { Resend } from "resend";
import { createHmac } from "crypto";
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
    html: `
      <p>The auction for <strong>${plantName}</strong> has been cancelled by the seller.</p>
      <p>Your bid has been voided — you will not be charged.</p>
      <p><a href="${process.env.NEXT_PUBLIC_APP_URL}/auctions/${auctionId}">View auction</a></p>
    `,
  });
}

export function buildWelcomeHtml({ username }: { username: string }): string {
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Welcome to Plantet</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">

        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%);padding:40px 32px 36px;text-align:center;">
              <p style="margin:0 0 10px;color:#bbf7d0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🌿 Plantet</p>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:28px;font-weight:700;line-height:1.25;">Welcome to Plantet!</h1>
              <p style="margin:0;color:#86efac;font-size:14px;font-weight:500;">Your plant community is ready.</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 8px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Hey ${username} 👋</p>
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">You're now part of a community built for plant lovers — whether you're hunting for a rare find, growing your own collection, or looking to sell some cuttings. Here's everything you can do on Plantet.</p>
            </td>
          </tr>

          <!-- Feature highlights -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <p style="margin:0 0 16px;font-size:15px;font-weight:700;color:#111827;">What you can do</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">🛒</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Shop &amp; Auctions</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Browse fixed-price listings or bid on live timed auctions from nurseries and collectors.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">🪴</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Garden Log</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Track every plant you own — photos, care schedule, event history, and a shareable public garden.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 6px 12px 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">💬</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Community</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Ask for help, show off a plant you're proud of, or join a discussion with fellow growers.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 12px 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">📣</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Follow Sellers</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Follow your favorite shops and get their new arrivals and restocks straight in your feed.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">💚</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Wishlist</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Save listings and auctions you love, and build a wishlist of plants you're hunting for.</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;">
                      <tr><td style="padding:14px 16px;">
                        <p style="margin:0 0 4px;font-size:18px;">🎁</p>
                        <p style="margin:0 0 4px;font-size:13px;font-weight:700;color:#14532d;">Monthly Giveaway</p>
                        <p style="margin:0;font-size:12px;color:#4b7c5e;line-height:1.5;">Every month we give away a plant prize. One entry per member — enter any time.</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Buyer / Seller columns -->
          <tr>
            <td style="padding:24px 32px 8px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;">
                      <tr><td style="padding:16px;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#92400e;">For Buyers</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#78350f;line-height:1.6;">✔ Browse the shop and live auctions</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#78350f;line-height:1.6;">✔ Bid in real time with snipe protection</p>
                        <p style="margin:0;font-size:12px;color:#78350f;line-height:1.6;">✔ Track your plants in the garden log</p>
                      </td></tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#ecfdf5;border:1px solid #6ee7b7;border-radius:10px;">
                      <tr><td style="padding:16px;">
                        <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#065f46;">For Sellers</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#064e3b;line-height:1.6;">✔ Build a free public storefront</p>
                        <p style="margin:0 0 6px;font-size:12px;color:#064e3b;line-height:1.6;">✔ List plants or run timed auctions</p>
                        <p style="margin:0;font-size:12px;color:#064e3b;line-height:1.6;">✔ Get paid directly via Stripe — no monthly fee</p>
                      </td></tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:32px 32px 40px;text-align:center;">
              <a href="${siteUrl}/account" style="display:inline-block;background:#15803d;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">Complete your profile →</a>
              <p style="margin:14px 0 0;font-size:12px;color:#9ca3af;">Add a photo, bio, and location so buyers and fellow plant lovers can find you.</p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you created a Plantet account.</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="${siteUrl}/account" style="color:#6b7280;text-decoration:underline;">Account settings</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6b7280;text-decoration:underline;">Privacy Policy</a>
                &nbsp;·&nbsp;
                © ${new Date().getFullYear()} Plantet
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
    subject: "Welcome to Plantet 🌱",
    html: buildWelcomeHtml({ username }),
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
  return createHmac("sha256", process.env.CRON_SECRET!)
    .update(userId)
    .digest("hex")
    .slice(0, 32);
}

function unsubUrl(userId: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
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
          : `<table width="100%" cellpadding="0" cellspacing="0"><tr><td height="150" style="height:150px;background:#dcfce7;border-radius:10px;text-align:center;vertical-align:middle;font-size:32px;">🌿</td></tr></table>`}
        <p style="margin:8px 0 2px;font-size:13px;font-weight:600;color:#111827;line-height:1.3;">${name}</p>
        <p style="margin:0 0 2px;font-size:13px;font-weight:700;color:#15803d;">${centsToDisplay(listing.price_cents)}</p>
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
                  : `<td width="100" height="100" style="width:100px;height:100px;background:#dcfce7;text-align:center;vertical-align:middle;font-size:28px;">🌿</td>`}
                <td style="padding:12px 16px;vertical-align:top;">
                  <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#111827;">${name}</p>
                  <p style="margin:0 0 6px;font-size:13px;color:#15803d;font-weight:700;">Current bid: ${centsToDisplay(a.current_bid_cents)}</p>
                  <p style="margin:0;font-size:12px;color:#9ca3af;">${a.bid_count} bid${a.bid_count !== 1 ? "s" : ""} · ${timeLabel} · by @${a.seller_username}</p>
                </td>
                <td style="padding:12px 16px;vertical-align:middle;text-align:right;">
                  <span style="display:inline-block;background:#15803d;color:#fff;font-size:12px;font-weight:600;padding:8px 14px;border-radius:6px;white-space:nowrap;">Bid now →</span>
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
        <p style="margin:0;font-size:11px;font-weight:700;color:#6b7280;letter-spacing:0.08em;text-transform:uppercase;">🔥 Hot auctions</p>
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
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your monthly plant digest — Plantet</title>
</head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr>
      <td align="center" style="padding:32px 16px 48px;">

        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%);padding:40px 32px 36px;text-align:center;">
              <p style="margin:0 0 10px;color:#bbf7d0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🌿 Plantet</p>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.25;">Your Weekly Plant Digest</h1>
              <p style="margin:0;color:#86efac;font-size:14px;font-weight:500;">${month}</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Hey ${username} 👋</p>
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.65;">Here's what's been growing this week on Plantet — fresh listings, new arrivals from shops you follow, and auctions you don't want to miss.</p>
            </td>
          </tr>

          ${listingSection("From shops you follow", followedListings, siteUrl)}
          ${listingSection("Fresh picks this week", freshListings, siteUrl)}
          ${auctionSection(hotAuctions, siteUrl)}

          <!-- Giveaway banner -->
          <tr>
            <td style="padding:8px 32px 0;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;overflow:hidden;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:18px;">🎁</p>
                    <p style="margin:0 0 6px;font-size:15px;font-weight:700;color:#14532d;">Monthly Giveaway</p>
                    <p style="margin:0 0 16px;font-size:13px;color:#166534;line-height:1.6;">Enter for a chance to win this month's plant prize. One entry per member — entries reset each month.</p>
                    <a href="${siteUrl}/giveaway" style="display:inline-block;background:#15803d;color:#ffffff;font-size:13px;font-weight:600;text-decoration:none;padding:10px 24px;border-radius:7px;">Enter the giveaway →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main CTA -->
          <tr>
            <td style="padding:8px 32px 40px;text-align:center;">
              <a href="${siteUrl}/shop" style="display:inline-block;background:#15803d;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">Browse the full shop →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you opted in to Plantet marketing emails.</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="${unsubUrl(userId)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6b7280;text-decoration:underline;">Privacy Policy</a>
                &nbsp;·&nbsp;
                © ${new Date().getFullYear()} Plantet
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

export async function sendMonthlyDigest({
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
    subject: `🌿 Your weekly plant digest — ${month}`,
    html,
  });
}

// ─── Re-engagement email ────────────────────────────────────────────────────

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
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  const listingsHtml = freshListings.length ? listingSection("What's new on Plantet", freshListings, siteUrl) : "";

  const html = `<!DOCTYPE html>
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
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%);padding:40px 32px 36px;text-align:center;">
              <p style="margin:0 0 10px;color:#bbf7d0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🌿 Plantet</p>
              <h1 style="margin:0 0 8px;color:#ffffff;font-size:26px;font-weight:700;line-height:1.25;">We've missed you!</h1>
              <p style="margin:0;color:#86efac;font-size:14px;font-weight:500;">It's been a while — come see what's growing</p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">Hey ${username} 👋</p>
              <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.65;">We noticed you haven't stopped by in a while. The shop has been growing — here are some fresh finds we think you'll love.</p>
            </td>
          </tr>

          ${listingsHtml}

          <!-- Main CTA -->
          <tr>
            <td style="padding:8px 32px 40px;text-align:center;">
              <a href="${siteUrl}/shop" style="display:inline-block;background:#15803d;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:8px;">See what's new →</a>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <div style="height:1px;background:#e5e7eb;"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;color:#9ca3af;line-height:1.6;">You're receiving this because you opted in to Plantet marketing emails.</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                <a href="${unsubUrl(userId)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/privacy-policy" style="color:#6b7280;text-decoration:underline;">Privacy Policy</a>
                &nbsp;·&nbsp;
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

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: "We've missed you on Plantet 🌱",
    html,
  });
}

// ─── Garden care reminder digest ────────────────────────────────────────────

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
  const siteUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "https://plantet.shop").replace(/\/$/, "");
  const rows = items.map((item) => `
    <tr>
      <td style="padding:8px 12px;font-size:13px;color:#111827;border-bottom:1px solid #f3f4f6;">${item.plantName}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">${item.careType}</td>
      <td style="padding:8px 12px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;">${item.nextDueDate}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Your garden care schedule — ${month}</title></head>
<body style="margin:0;padding:0;background:#f0fdf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;">
    <tr><td align="center" style="padding:32px 16px 48px;">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.07);">

        <tr>
          <td style="background:linear-gradient(135deg,#14532d 0%,#166534 60%,#15803d 100%);padding:36px 32px;text-align:center;">
            <p style="margin:0 0 8px;color:#bbf7d0;font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;">🌿 Plantet</p>
            <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;">Your Garden Care Schedule</h1>
            <p style="margin:0;color:#86efac;font-size:14px;">${month}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 6px;font-size:17px;font-weight:600;color:#111827;">Hey ${username} 👋</p>
            <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.65;">Here's what your garden needs this month. Log each task directly from your garden page to keep your schedule on track.</p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
              <tr style="background:#f9fafb;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Plant</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Care</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.06em;">Due by</th>
              </tr>
              ${rows}
            </table>
          </td>
        </tr>

        <tr>
          <td style="padding:0 32px 40px;text-align:center;">
            <a href="${siteUrl}/garden" style="display:inline-block;background:#15803d;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px;">Open My Garden →</a>
          </td>
        </tr>

        <tr><td style="padding:0 32px;"><div style="height:1px;background:#e5e7eb;"></div></td></tr>
        <tr>
          <td style="padding:20px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              <a href="${unsubUrl(userId)}" style="color:#6b7280;text-decoration:underline;">Unsubscribe</a>
              &nbsp;·&nbsp;&copy; ${new Date().getFullYear()} Plantet
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const resend = getResend();
  await resend.emails.send({
    from: FROM,
    to: recipientEmail,
    subject: `🌿 Your garden care schedule for ${month}`,
    html,
  });
}

// ─── Low stock alert ────────────────────────────────────────────────────────

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
