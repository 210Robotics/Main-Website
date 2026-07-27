import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Resource-level checks live in each protected page, action, and route.
export function docsDomainResponse(request: Request & { nextUrl: URL }) {
  const host = request.headers.get("host")?.split(":")[0].toLowerCase();
  if (host !== "docs.210robotics.com") return null;
  const pathname = request.nextUrl.pathname;
  if (
    pathname.startsWith("/docs") ||
    pathname.startsWith("/doxygen") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next")
  )
    return null;
  if (pathname !== "/") {
    const mainSiteUrl = new URL(pathname, "https://210robotics.com");
    mainSiteUrl.search = request.nextUrl.search;
    return NextResponse.redirect(mainSiteUrl);
  }
  const url = new URL(request.url);
  url.pathname = "/docs";
  return NextResponse.rewrite(url);
}

const clerkProxy = clerkMiddleware(
  async (_auth, request) => docsDomainResponse(request) ?? NextResponse.next(),
);

const passthrough = (request: Parameters<typeof docsDomainResponse>[0]) =>
  docsDomainResponse(request) ?? NextResponse.next();
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
process.env.CLERK_SECRET_KEY
  ? clerkProxy
  : passthrough;

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
