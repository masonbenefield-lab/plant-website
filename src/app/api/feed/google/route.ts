import { createClient } from "@/lib/supabase/server";
import { centsToDisplay } from "@/lib/stripe";

const siteUrl = "https://www.plantet.shop";

export async function GET() {
  const supabase = await createClient();

  // Only include listings from Stripe-onboarded sellers
  const { data: onboardedSellers } = await supabase
    .from("profiles")
    .select("id, username, display_name, location")
    .eq("stripe_onboarded", true)
    .is("deleted_at", null);

  const onboardedSellerIds = (onboardedSellers ?? []).map((s) => s.id);
  const sellerMap = Object.fromEntries((onboardedSellers ?? []).map((s) => [s.id, s]));

  if (!onboardedSellerIds.length) {
    return new Response(buildFeed([]), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
  }

  const { data: listings } = await supabase
    .from("listings")
    .select("id, plant_name, variety, description, price_cents, images, category, quantity, status, free_shipping, shipping_cost_cents, seller_id, created_at")
    .eq("status", "active")
    .in("seller_id", onboardedSellerIds)
    .or("category.neq.Hidden,category.is.null")
    .order("created_at", { ascending: false })
    .limit(5000);

  return new Response(buildFeed(listings ?? [], sellerMap), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

type Seller = { id: string; username: string; display_name: string | null; location: string | null };

function buildFeed(listings: any[], sellerMap: Record<string, Seller> = {}) {
  const items = listings.map((l) => {
    const seller = sellerMap[l.seller_id];
    const title = l.variety ? `${l.plant_name} ${l.variety}` : l.plant_name;
    const price = (l.price_cents / 100).toFixed(2);
    const image = (l.images as string[])?.[0] ?? "";
    const description = l.description
      ? l.description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      : `${title} available on Plantet`;
    const shipping = l.free_shipping
      ? `<g:shipping><g:country>US</g:country><g:price>0 USD</g:price></g:shipping>`
      : l.shipping_cost_cents
        ? `<g:shipping><g:country>US</g:country><g:price>${(l.shipping_cost_cents / 100).toFixed(2)} USD</g:price></g:shipping>`
        : "";
    const brand = seller?.display_name ?? seller?.username ?? "Plantet Seller";

    return `
    <item>
      <g:id>${l.id}</g:id>
      <g:title>${title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</g:title>
      <g:description>${description}</g:description>
      <g:link>${siteUrl}/shop/${l.id}</g:link>
      ${image ? `<g:image_link>${image}</g:image_link>` : ""}
      <g:price>${price} USD</g:price>
      <g:availability>in_stock</g:availability>
      <g:condition>new</g:condition>
      <g:brand>${brand.replace(/&/g, "&amp;")}</g:brand>
      ${l.category ? `<g:product_type>${l.category.replace(/&/g, "&amp;")}</g:product_type>` : ""}
      ${shipping}
      <g:identifier_exists>no</g:identifier_exists>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Plantet — Buy, Sell &amp; Auction Plants</title>
    <link>${siteUrl}</link>
    <description>Plants for sale on Plantet from independent growers across the US.</description>
    ${items}
  </channel>
</rss>`;
}
