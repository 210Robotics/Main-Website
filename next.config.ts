import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    return [
      {
        source: "/doxygen",
        destination: "/doxygen/index.html",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
      { protocol: "https", hostname: "img.clerk.com" },
      {
        protocol: "https",
        hostname: "news.utsa.edu",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
