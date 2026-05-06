import { NextResponse } from "next/server";
import { buildDigestHtml } from "@/lib/email";
import type { DigestListing, DigestAuction } from "@/lib/email";

const FAKE_FOLLOWED: DigestListing[] = [
  { id: "p1", seller_id: "s1", plant_name: "Monstera Deliciosa", variety: "Thai Constellation", price_cents: 8500, images: [], seller_username: "tropical_gems" },
  { id: "p2", seller_id: "s1", plant_name: "Hoya Kerrii", variety: "Variegated Heart", price_cents: 3200, images: [], seller_username: "tropical_gems" },
  { id: "p3", seller_id: "s2", plant_name: "Philodendron Pink Princess", variety: null, price_cents: 12000, images: [], seller_username: "rare_roots" },
  { id: "p4", seller_id: "s2", plant_name: "Alocasia Dragon Scale", variety: null, price_cents: 4500, images: [], seller_username: "rare_roots" },
];

const FAKE_FRESH: DigestListing[] = [
  { id: "p5", seller_id: "s3", plant_name: "Pothos N'Joy", variety: null, price_cents: 1800, images: [], seller_username: "green_thumb_co" },
  { id: "p6", seller_id: "s4", plant_name: "String of Pearls", variety: null, price_cents: 2200, images: [], seller_username: "succulent_shop" },
  { id: "p7", seller_id: "s5", plant_name: "Bird of Paradise", variety: "Large", price_cents: 6500, images: [], seller_username: "plant_palace" },
];

const FAKE_AUCTIONS: DigestAuction[] = [
  {
    id: "a1",
    plant_name: "Variegated Monstera Albo",
    variety: null,
    current_bid_cents: 18500,
    ends_at: new Date(Date.now() + 5 * 3600 * 1000).toISOString(),
    images: [],
    bid_count: 7,
    seller_username: "rare_roots",
  },
  {
    id: "a2",
    plant_name: "Anthurium Veitchii",
    variety: "Large leaf",
    current_bid_cents: 9200,
    ends_at: new Date(Date.now() + 26 * 3600 * 1000).toISOString(),
    images: [],
    bid_count: 3,
    seller_username: "tropical_gems",
  },
];

export async function GET() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const month = `Week of ${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

  const html = buildDigestHtml({
    username: "plant_lover",
    userId: "preview",
    month,
    followedListings: FAKE_FOLLOWED,
    freshListings: FAKE_FRESH,
    hotAuctions: FAKE_AUCTIONS,
  });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
