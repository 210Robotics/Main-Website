import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Lexend, Space_Mono } from "next/font/google";
import { SiteChrome } from "@/components/site-chrome";
import { clerkAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const lexend = Lexend({ variable: "--font-lexend", subsets: ["latin"] });
const spaceMono = Space_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://210robotics.com"),
  title: { default: "210 Robotics | Build what comes next", template: "%s | 210 Robotics" },
  description: "UT San Antonio students building competition robots, autonomous systems, and the next generation of engineers.",
  openGraph: { title: "210 Robotics", description: "Build what comes next.", images: ["/media/brand/siemens-team.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const configured = Boolean(publishableKey);
  const content = <SiteChrome>{children}</SiteChrome>;
  return (
    <html lang="en" className={`${lexend.variable} ${spaceMono.variable}`} data-scroll-behavior="smooth">
      <body>{configured ? <ClerkProvider appearance={clerkAppearance} signInFallbackRedirectUrl="/portal" signUpForceRedirectUrl="/pending">{content}</ClerkProvider> : content}</body>
    </html>
  );
}
