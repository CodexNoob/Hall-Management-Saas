import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Event Core",
    short_name: "Event Core",
    description:
      "Hall, event, kitchen, payment, and calendar management platform.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#1f4d73",
    icons: [
      {
        src: "/images/icons/sidebar-left.png",
        sizes: "192x192",
        type: "image/png"
      },
      {
        src: "/images/icons/sidebar-left.png",
        sizes: "512x512",
        type: "image/png"
      }
    ]
  };
}
