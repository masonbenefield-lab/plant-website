import { createClient } from "@supabase/supabase-js";
import type { MetadataRoute } from "next";

const BASE = "https://www.plantet.shop";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE,                        changeFrequency: "daily",   priority: 1.0 },
    { url: `${BASE}/shop`,              changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE}/auctions`,          changeFrequency: "hourly",  priority: 0.9 },
    { url: `${BASE}/giveaway`,          changeFrequency: "weekly",  priority: 0.7 },
    { url: `${BASE}/community`,         changeFrequency: "daily",   priority: 0.7 },
    { url: `${BASE}/pricing`,           changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/contact`,           changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/giveaway/rules`,    changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/seller-agreement`,  changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/privacy-policy`,    changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`,             changeFrequency: "monthly", priority: 0.3 },
  ];

  const [
    { data: listings },
    { data: sellers },
    { data: gardens },
    { data: auctions },
    { data: posts },
  ] = await Promise.all([
    admin
      .from("listings")
      .select("id, updated_at")
      .eq("status", "active")
      .limit(5000),
    admin
      .from("profiles")
      .select("username, updated_at")
      .is("deleted_at", null)
      .limit(2000),
    admin
      .from("profiles")
      .select("username, updated_at")
      .eq("garden_public", true)
      .is("deleted_at", null)
      .limit(2000),
    admin
      .from("auctions")
      .select("id, updated_at")
      .eq("status", "active")
      .limit(1000),
    admin
      .from("posts")
      .select("id, updated_at")
      .limit(2000),
  ]);

  const listingUrls: MetadataRoute.Sitemap = (listings ?? []).map((l) => ({
    url: `${BASE}/shop/${l.id}`,
    lastModified: l.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const sellerUrls: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `${BASE}/sellers/${s.username}`,
    lastModified: s.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const gardenUrls: MetadataRoute.Sitemap = (gardens ?? []).map((g) => ({
    url: `${BASE}/gardens/${g.username}`,
    lastModified: g.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const auctionUrls: MetadataRoute.Sitemap = (auctions ?? []).map((a) => ({
    url: `${BASE}/auctions/${a.id}`,
    lastModified: a.updated_at ?? undefined,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  const postUrls: MetadataRoute.Sitemap = (posts ?? []).map((p) => ({
    url: `${BASE}/community/${p.id}`,
    lastModified: p.updated_at ?? undefined,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [
    ...staticPages,
    ...listingUrls,
    ...sellerUrls,
    ...gardenUrls,
    ...auctionUrls,
    ...postUrls,
  ];
}
