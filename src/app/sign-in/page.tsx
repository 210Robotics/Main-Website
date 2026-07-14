import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { hasClerk } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };
export default function SignInPage() {
  return <section className="grid-bg min-h-[760px] py-20"><div className="shell grid items-start gap-12 lg:grid-cols-2"><div className="pt-8"><p className="eyebrow">Member portal</p><h1 className="display">Back to the build.</h1><p className="lede mt-7">Record hours, document contributions, manage your public profile, and keep the team’s work visible.</p><p className="mt-7 text-sm leading-7 text-[#999]">Email and password only. Every new account requires email verification and manual officer approval.</p></div><div className="flex justify-center lg:justify-end">{hasClerk() ? <SignIn routing="path" path="/sign-in" signUpUrl="/register" fallbackRedirectUrl="/portal" appearance={{elements:{socialButtonsBlockButton:"hidden",dividerRow:"hidden"}}}/> : <ServiceNotice/>}</div></div></section>;
}
function ServiceNotice(){return <div className="card max-w-md p-8"><p className="eyebrow">Secure access</p><h2 className="mt-5 text-2xl font-bold">Account service setup is in progress.</h2><p className="mt-4 text-sm leading-7 text-[#aaa]">No demo login is available. Please return after the production identity service is connected.</p></div>}
