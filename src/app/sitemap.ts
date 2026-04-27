import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://plantet.co";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: listings }, { data: auctions }, { data: profiles }] = await Promise.all([
    supabase.from("listings").select("id, created_at").eq("status", "active"),
    supabase.from("auctions").select("id, created_at").eq("status", "active"),
    supabase.from("profiles").select("username, created_at").not("username", "is", null),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE_URL}/shop`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/auctions`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE_URL}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
  ];

  const listingRoutes: MetadataRoute.Sitemap = (listings ?? []).map((l) => ({
    url: `${BASE_URL}/shop/${l.id}`,
    lastModified: l.created_at ? new Date(l.created_at) : new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const auctionRoutes: MetadataRoute.Sitemap = (auctions ?? []).map((a) => ({
    url: `${BASE_URL}/auctions/${a.id}`,
    lastModified: a.created_at ? new Date(a.created_at) : new Date(),
    changeFrequency: "hourly",
    priority: 0.9,
  }));

  const sellerRoutes: MetadataRoute.Sitemap = (profiles ?? []).map((p) => ({
    url: `${BASE_URL}/sellers/${p.username}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...listingRoutes, ...auctionRoutes, ...sellerRoutes];
}
