import { createClient } from "@/lib/supabase/server";
import type { MetadataRoute } from "next";

const siteUrl = "https://www.plantet.shop";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();

  const [{ data: listings }, { data: auctions }, { data: sellers }] = await Promise.all([
    supabase.from("listings").select("id, created_at").eq("status", "active").limit(1000),
    supabase.from("auctions").select("id, created_at").eq("status", "active").limit(500),
    supabase.from("profiles").select("username").eq("stripe_onboarded", true).is("deleted_at", null).limit(500),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/shop`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/auctions`, lastModified: new Date(), changeFrequency: "hourly", priority: 0.9 },
    { url: `${siteUrl}/pricing`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/privacy-policy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/seller-agreement`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/contact`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
  ];

  const listingPages: MetadataRoute.Sitemap = (listings ?? []).map((l) => ({
    url: `${siteUrl}/shop/${l.id}`,
    lastModified: new Date(l.created_at),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const auctionPages: MetadataRoute.Sitemap = (auctions ?? []).map((a) => ({
    url: `${siteUrl}/auctions/${a.id}`,
    lastModified: new Date(a.created_at),
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  const sellerPages: MetadataRoute.Sitemap = (sellers ?? []).map((s) => ({
    url: `${siteUrl}/sellers/${s.username}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticPages, ...listingPages, ...auctionPages, ...sellerPages];
}
