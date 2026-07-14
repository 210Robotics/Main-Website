import type { MetadataRoute } from "next";
export default function robots():MetadataRoute.Robots{return {rules:{userAgent:"*",allow:"/",disallow:["/portal","/admin"]},sitemap:`${process.env.NEXT_PUBLIC_SITE_URL??"https://210robotics.com"}/sitemap.xml`}}
