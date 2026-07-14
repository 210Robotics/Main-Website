import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "210 Robotics",
    short_name: "210 Robotics",
    description: "UT San Antonio students building competition robots and autonomous systems.",
    start_url: "/",
    display: "standalone",
    background_color: "#080808",
    theme_color: "#fd7803",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
