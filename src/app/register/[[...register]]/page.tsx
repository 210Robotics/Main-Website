import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { hasClerk } from "@/lib/auth";
import { clerkAuthAppearance } from "@/lib/clerk-appearance";

export const metadata: Metadata = { title: "Register" };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const { redirect_url: requestedRedirect } = await searchParams;
  const safeRedirect = requestedRedirect?.startsWith("/discord/connect")
    ? requestedRedirect
    : "/pending";
  return (
    <section className="grid-bg min-h-[760px] py-20">
      <div className="shell grid items-start gap-12 lg:grid-cols-2">
        <div className="pt-8">
          <p className="eyebrow">Create an account</p>
          <h1 className="display">Join the portal.</h1>
          <p className="lede mt-7">
            Continue with Google or register with email and password. Your
            account remains pending until an admin verifies your membership and
            assigns access.
          </p>
          <p className="mt-7 text-sm leading-7 text-[#999]">
            Approved active member names and organization titles appear in the
            public directory. Emails, permissions, hours, and contributions
            remain private.
          </p>
        </div>
        <div className="flex justify-center lg:justify-end">
          {hasClerk() ? (
            <SignUp
              routing="path"
              path="/register"
              signInUrl={`/sign-in?redirect_url=${encodeURIComponent(safeRedirect)}`}
              forceRedirectUrl={safeRedirect}
              fallbackRedirectUrl={safeRedirect}
              appearance={clerkAuthAppearance}
            />
          ) : (
            <div className="card max-w-md p-8">
              <h2 className="text-2xl font-bold">
                Registration is opening soon.
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#aaa]">
                The production account service is being connected. Use the Join
                form to contact the team now.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
