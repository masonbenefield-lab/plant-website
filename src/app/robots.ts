import type { MetadataRoute } from "next";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://plantet.co";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/dashboard/", "/account/", "/admin/", "/checkout/", "/api/"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
