import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/shop", "/auctions", "/sellers", "/pricing", "/contact", "/privacy-policy", "/terms", "/seller-agreement"],
        disallow: ["/dashboard", "/account", "/garden", "/gardens", "/admin", "/api", "/login", "/signup", "/welcome", "/orders", "/messages"],
      },
    ],
    sitemap: "https://www.plantet.shop/sitemap.xml",
  };
}
