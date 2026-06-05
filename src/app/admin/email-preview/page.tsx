import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailPreviewClient } from "./preview-client";
import {
  buildOrderConfirmationHtml,
  buildAuctionWonHtml,
  buildOfferReceivedHtml,
  buildOfferAcceptedHtml,
  buildOfferDeclinedHtml,
  buildRestockNotificationHtml,
  buildPriceDropAlertHtml,
  buildAuctionEndingSoonHtml,
  buildOutbidNotificationHtml,
  buildAuctionCancelledHtml,
  buildNewOrderAlertHtml,
  buildShippingNotificationHtml,
  buildLowStockAlertHtml,
  buildWelcomeHtml,
  buildDigestHtml,
  buildReengagementHtml,
  buildGardenCareReminderHtml,
  buildConfirmationEmailHtml,
  buildPasswordResetHtml,
  buildChangeEmailHtml,
  buildPasswordChangedHtml,
  buildEmailChangedHtml,
  buildReserveOfferToBuyerHtml,
  buildReserveOfferAcceptedHtml,
  buildReserveOfferAcceptedSellerHtml,
  buildReserveOfferDeclinedHtml,
  buildReserveOfferExpiredHtml,
  buildWeeklyCareSummaryHtml,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const PREVIEW_SITE = "https://plantet.shop";
const PREVIEW_ORDER_ID = "preview-order-abc123";
const PREVIEW_AUCTION_ID = "preview-auction-abc123";
const PREVIEW_CHECKOUT_URL = `${PREVIEW_SITE}/checkout?preview=1`;
const PREVIEW_LISTING_URL = `${PREVIEW_SITE}/shop/preview-listing`;

const sampleAddress = {
  name: "Jane Smith",
  line1: "123 Garden Lane",
  line2: "Apt 4B",
  city: "Austin",
  state: "TX",
  zip: "78701",
  country: "US",
};

const sampleListings = [
  {
    id: "l1",
    seller_id: "s1",
    plant_name: "Monstera deliciosa",
    variety: "Thai Constellation",
    price_cents: 8500,
    images: [],
    seller_username: "planthaus",
  },
  {
    id: "l2",
    seller_id: "s2",
    plant_name: "Hoya kerrii",
    variety: null,
    price_cents: 2400,
    images: [],
    seller_username: "leaflover",
  },
  {
    id: "l3",
    seller_id: "s3",
    plant_name: "Philodendron gloriosum",
    variety: null,
    price_cents: 6500,
    images: [],
    seller_username: "raregreens",
  },
];

const sampleAuctions = [
  {
    id: "a1",
    plant_name: "Monstera obliqua",
    variety: "Peru",
    current_bid_cents: 14500,
    ends_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    images: [],
    bid_count: 7,
    seller_username: "planthaus",
  },
];

export default async function EmailPreviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!(profile as { is_admin?: boolean } | null)?.is_admin) redirect("/");

  const emails = [
    // ── Auth ─────────────────────────────────────────────────────────────────
    {
      id: "email-confirmation",
      label: "Confirm Email",
      category: "Auth",
      html: buildConfirmationEmailHtml({
        confirmUrl: `${PREVIEW_SITE}/auth/callback?code=preview-token`,
      }),
    },
    {
      id: "password-reset",
      label: "Reset Password",
      category: "Auth",
      html: buildPasswordResetHtml({
        confirmUrl: `${PREVIEW_SITE}/auth/callback?type=recovery&token=preview-token`,
      }),
    },
    {
      id: "change-email",
      label: "Change Email",
      category: "Auth",
      html: buildChangeEmailHtml({
        confirmUrl: `${PREVIEW_SITE}/auth/callback?type=email_change&token=preview-token`,
      }),
    },
    {
      id: "password-changed",
      label: "Password Changed",
      category: "Auth",
      html: buildPasswordChangedHtml(),
    },
    {
      id: "email-changed",
      label: "Email Changed",
      category: "Auth",
      html: buildEmailChangedHtml({ newEmail: "jane@example.com" }),
    },
    // ── Buyer transactional ──────────────────────────────────────────────────
    {
      id: "order-confirmation",
      label: "Order Confirmed",
      category: "Buyer",
      html: buildOrderConfirmationHtml({
        plantName: "Monstera deliciosa — Thai Constellation",
        amountCents: 8500,
        orderId: PREVIEW_ORDER_ID,
      }),
    },
    {
      id: "shipping-notification",
      label: "Order Shipped",
      category: "Buyer",
      html: buildShippingNotificationHtml({
        plantName: "Monstera deliciosa — Thai Constellation",
        trackingNumber: "1Z999AA10123456784",
        orderId: PREVIEW_ORDER_ID,
      }),
    },
    {
      id: "offer-accepted",
      label: "Offer Accepted",
      category: "Buyer",
      html: buildOfferAcceptedHtml({
        plantName: "Hoya kerrii",
        amountCents: 2000,
        checkoutUrl: PREVIEW_CHECKOUT_URL,
      }),
    },
    {
      id: "offer-declined",
      label: "Offer Declined",
      category: "Buyer",
      html: buildOfferDeclinedHtml({
        plantName: "Hoya kerrii",
        listingUrl: PREVIEW_LISTING_URL,
      }),
    },
    // ── Auction buyer ────────────────────────────────────────────────────────
    {
      id: "auction-won",
      label: "Auction Won",
      category: "Auction",
      html: buildAuctionWonHtml({
        plantName: "Monstera obliqua — Peru",
        amountCents: 14500,
        checkoutUrl: PREVIEW_CHECKOUT_URL,
      }),
    },
    {
      id: "outbid",
      label: "Outbid Notification",
      category: "Auction",
      html: buildOutbidNotificationHtml({
        plantName: "Monstera obliqua — Peru",
        auctionId: PREVIEW_AUCTION_ID,
        newBidCents: 15500,
      }),
    },
    {
      id: "auction-ending-soon",
      label: "Auction Ending Soon",
      category: "Auction",
      html: buildAuctionEndingSoonHtml({
        plantName: "Monstera obliqua — Peru",
        auctionUrl: `${PREVIEW_SITE}/auctions/${PREVIEW_AUCTION_ID}`,
        endsAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      }),
    },
    {
      id: "auction-cancelled",
      label: "Auction Cancelled",
      category: "Auction",
      html: buildAuctionCancelledHtml({
        plantName: "Monstera obliqua — Peru",
        auctionId: PREVIEW_AUCTION_ID,
      }),
    },
    // ── Seller ───────────────────────────────────────────────────────────────
    {
      id: "new-order-alert",
      label: "New Order Alert",
      category: "Seller",
      html: buildNewOrderAlertHtml({
        plantName: "Monstera deliciosa — Thai Constellation",
        amountCents: 8500,
        orderId: PREVIEW_ORDER_ID,
        buyerName: "Jane Smith",
        shippingAddress: sampleAddress,
      }),
    },
    {
      id: "offer-received",
      label: "Offer Received",
      category: "Seller",
      html: buildOfferReceivedHtml({
        sellerUsername: "planthaus",
        buyerUsername: "plantnerd42",
        plantName: "Hoya kerrii",
        amountCents: 2000,
        message: "Would you take $20? Happy to pay shipping on top.",
      }),
    },
    {
      id: "low-stock-alert",
      label: "Low Stock Alert",
      category: "Seller",
      html: buildLowStockAlertHtml({
        plantName: "Philodendron gloriosum",
        variety: null,
        quantity: 2,
        inventoryId: "inv-preview-123",
      }),
    },
    // ── Wishlist / marketing ─────────────────────────────────────────────────
    {
      id: "restock",
      label: "Back in Stock",
      category: "Marketing",
      html: buildRestockNotificationHtml({
        plantName: "Hoya kerrii",
        listingUrl: PREVIEW_LISTING_URL,
      }),
    },
    {
      id: "price-drop",
      label: "Price Drop Alert",
      category: "Marketing",
      html: buildPriceDropAlertHtml({
        plantName: "Philodendron gloriosum",
        regularCents: 6500,
        saleCents: 4999,
        listingUrl: PREVIEW_LISTING_URL,
      }),
    },
    // ── Account / digest ─────────────────────────────────────────────────────
    {
      id: "welcome",
      label: "Welcome Email",
      category: "Account",
      html: buildWelcomeHtml({ username: "plantlover" }),
    },
    {
      id: "digest",
      label: "Weekly Digest",
      category: "Account",
      html: buildDigestHtml({
        username: "plantlover",
        userId: "preview-user-id",
        month: "May 2026",
        followedListings: sampleListings.slice(0, 2),
        freshListings: sampleListings,
        hotAuctions: sampleAuctions,
      }),
    },
    {
      id: "reengagement",
      label: "Re-engagement",
      category: "Account",
      html: buildReengagementHtml({
        username: "plantlover",
        userId: "preview-user-id",
        freshListings: sampleListings,
      }),
    },
    {
      id: "reserve-offer-accepted",
      label: "Reserve Offer Accepted (Buyer)",
      category: "Auction",
      html: buildReserveOfferAcceptedHtml({
        plantName: "Monstera Deliciosa",
        amountCents: 3450,
        appUrl: PREVIEW_SITE,
      }),
    },
    {
      id: "reserve-offer-buyer",
      label: "Reserve Offer — Confirm (Buyer)",
      category: "Auction",
      html: buildReserveOfferToBuyerHtml({
        plantName: "Monstera Deliciosa",
        bidCents: 2800,
        shippingLabel: "USPS Priority Mail — $8.50",
        offerUrl: `${PREVIEW_SITE}/auctions/${PREVIEW_AUCTION_ID}/reserve-offer`,
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      }),
    },
    {
      id: "reserve-offer-accepted-seller",
      label: "Reserve Offer Accepted (Seller)",
      category: "Seller",
      html: buildReserveOfferAcceptedSellerHtml({
        plantName: "Monstera Deliciosa",
        buyerUsername: "plantlover99",
        amountCents: 3450,
        shippingAddress: sampleAddress,
        dashboardUrl: `${PREVIEW_SITE}/dashboard/orders`,
      }),
    },
    {
      id: "reserve-offer-declined",
      label: "Reserve Offer Declined (Seller)",
      category: "Seller",
      html: buildReserveOfferDeclinedHtml({
        plantName: "Monstera Deliciosa",
        buyerUsername: "plantlover99",
        bidCents: 2800,
        dashboardUrl: `${PREVIEW_SITE}/dashboard/auctions`,
      }),
    },
    {
      id: "reserve-offer-expired",
      label: "Reserve Offer Expired (Seller)",
      category: "Seller",
      html: buildReserveOfferExpiredHtml({
        plantName: "Monstera Deliciosa",
        bidCents: 2800,
        dashboardUrl: `${PREVIEW_SITE}/dashboard/auctions`,
      }),
    },
    {
      id: "weekly-care-summary",
      label: "Weekly Care Summary",
      category: "Account",
      html: buildWeeklyCareSummaryHtml({
        username: "plantlover",
        days: [
          { label: "Mon, Jun 9",  tasks: [{ plantName: "Monstera deliciosa", careType: "Water" }, { plantName: "Hoya kerrii", careType: "Fertilize" }] },
          { label: "Wed, Jun 11", tasks: [{ plantName: "Philodendron gloriosum", careType: "Water" }] },
          { label: "Fri, Jun 13", tasks: [{ plantName: "Monstera deliciosa", careType: "Prune" }, { plantName: "Hoya kerrii", careType: "Water" }] },
        ],
        totalCount: 8,
        weekRange: "Jun 9 – Jun 15",
      }),
    },
    {
      id: "garden-care",
      label: "Garden Care Reminder",
      category: "Account",
      html: buildGardenCareReminderHtml({
        username: "plantlover",
        userId: "preview-user-id",
        month: "May 2026",
        items: [
          { plantName: "Monstera deliciosa", careType: "Water", nextDueDate: "May 31" },
          { plantName: "Hoya kerrii", careType: "Fertilize", nextDueDate: "Jun 1" },
          { plantName: "Philodendron gloriosum", careType: "Repot", nextDueDate: "Jun 5" },
        ],
      }),
    },
  ];

  return <EmailPreviewClient emails={emails} />;
}
