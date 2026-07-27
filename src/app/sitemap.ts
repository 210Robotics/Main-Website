import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://210robotics.com";
  return [
    "",
    "/about",
    "/programs/vex-u",
    "/programs/sidc",
    "/projects/roborowdy",
    "/team",
    "/members",
    "/sponsors",
    "/news",
    "/events",
    "/media",
    "/resources",
    "/join",
    "/contact",
    "/privacy",
    "/terms",
  ].map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
  }));
}
