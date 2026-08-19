import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMember, hasClerk } from "@/lib/auth";
import { clerkAuthAppearance } from "@/lib/clerk-appearance";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ redirect_url?: string }> }) {
  const { redirect_url: requestedRedirect } = await searchParams;
  const safeRedirect = requestedRedirect?.startsWith("/attendance/check-in/") || requestedRedirect?.startsWith("/docs") || requestedRedirect?.startsWith("/discord/connect")
    ? requestedRedirect
    : "/portal";
  const member = await getCurrentMember();
  if (member?.status === "ACTIVE") redirect(safeRedirect);
  if (member && safeRedirect.startsWith("/discord/connect")) redirect(safeRedirect);
  if (member) redirect("/pending");
  return (
    <section className="grid-bg min-h-[calc(100dvh-74px)] py-10 sm:py-14 lg:py-20">
      <div className="shell grid items-start gap-6 lg:grid-cols-2 lg:gap-12">
        <div className="hidden lg:block lg:pt-8">
          <p className="eyebrow">Member portal</p>
          <h1 className="mt-4 text-4xl font-bold tracking-[-.05em] sm:text-5xl lg:text-6xl">
            Back to the build.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#c8c5bf] lg:mt-7 lg:text-lg lg:leading-8">
            Record hours, document contributions, manage your public profile,
            and keep the team’s work visible.
          </p>
          <p className="mt-4 text-sm leading-6 text-[#999] lg:mt-7 lg:leading-7">
            Continue with Google or use email and password. Every new account
            still requires manual officer approval before portal access.
          </p>
        </div>
        <div className="grid justify-items-center gap-4 lg:justify-items-end">
          <div className="w-full lg:hidden">
            <p className="eyebrow">Member portal</p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-.05em]">
              Back to the build.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#aaa]">
              Sign in with Google or your team email to open the portal.
            </p>
          </div>
          {hasClerk() ? (
            <>
              <SignIn
                routing="path"
                path="/sign-in"
                signUpUrl="/register"
                forceRedirectUrl={safeRedirect}
                fallbackRedirectUrl={safeRedirect}
                appearance={clerkAuthAppearance}
              />
              <div className="card w-full max-w-[400px] p-5 text-sm leading-6 text-[#aaa]">
                <strong className="text-white">Having trouble signing in?</strong>
                <p className="mt-2">
                  Use Google or enter your email, then select <strong className="text-[#ddd]">Forgot password</strong> to create or reset your password. If you have never registered, create an account using the same team email your admin approved.
                </p>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                  <Link className="text-[#fd7803] hover:text-white" href="/register">Create account</Link>
                  <Link className="text-[#fd7803] hover:text-white" href="/contact">Contact an admin</Link>
                </div>
              </div>
            </>
          ) : (
            <ServiceNotice />
          )}
        </div>
      </div>
    </section>
  );
}

function ServiceNotice() {
  return (
    <div className="card max-w-md p-8">
      <p className="eyebrow">Secure access</p>
      <h2 className="mt-5 text-2xl font-bold">
        Account service setup is in progress.
      </h2>
      <p className="mt-4 text-sm leading-7 text-[#aaa]">
        No demo login is available. Please return after the production identity
        service is connected.
      </p>
    </div>
  );
}
