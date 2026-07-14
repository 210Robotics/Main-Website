import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "news.utsa.edu", pathname: "/wp-content/uploads/**" },
    ],
  },
};

export default nextConfig;
