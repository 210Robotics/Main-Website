import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isProtected = createRouteMatcher(["/portal(.*)", "/admin(.*)"]);

const protectedProxy = clerkMiddleware(
  async (auth, request) => {
    if (isProtected(request)) {
      const session = await auth();
      if (!session.userId) {
        const signIn = new URL("/sign-in", request.url);
        signIn.searchParams.set("redirect_url", request.url);
        return NextResponse.redirect(signIn);
      }
    }
  },
  {
    frontendApiProxy: {
      enabled: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.startsWith("pk_live_") ?? false,
      path: "/__clerk",
    },
  },
);

const passthrough = () => NextResponse.next();
export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY ? protectedProxy : passthrough;

export const config = {
  matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)", "/(api|trpc)(.*)"],
};
