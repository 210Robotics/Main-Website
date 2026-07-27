import { NextResponse } from "next/server";
import { getPublishedCustomPages } from "@/lib/site-content";

export const dynamic = "force-dynamic";

export async function GET() {
  const links = (await getPublishedCustomPages())
    .filter((page) => page.showInNavigation)
    .map((page) => ({ href: `/${page.slug}`, label: page.navLabel }));
  return NextResponse.json(links, {
    headers: { "Cache-Control": "public, max-age=0, s-maxage=60" },
  });
}
