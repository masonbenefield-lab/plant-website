import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Plantet",
    short_name: "Plantet",
    description:
      "Track your plants, connect with fellow growers, and buy or sell — all in one place built for the plant-obsessed.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#2F7D54",
    orientation: "portrait",
    icons: [
      {
        src: "/plantet-app-icon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/plantet-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
