"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { UniversalQuickAdd } from "@/components/universal-quick-add";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const docs = pathname === "/docs" || pathname.startsWith("/docs/");
  if (docs) return <main id="main-content">{children}</main>;
  const focusedFlow =
    pathname === "/portal" ||
    pathname.startsWith("/portal/") ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/sign-in" ||
    pathname.startsWith("/sign-in/") ||
    pathname === "/register" ||
    pathname.startsWith("/register/") ||
    pathname === "/pending" ||
    pathname.startsWith("/attendance/check-in/");
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      <main id="main-content">{children}</main>
      <UniversalQuickAdd />
      {!focusedFlow && <SiteFooter />}
    </>
  );
}
