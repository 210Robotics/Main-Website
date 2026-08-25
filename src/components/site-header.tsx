"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Heart, LogIn, Menu, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { InquiryModal } from "@/components/inquiry-form";

type NavigationLink = { href: string; label: string };

const primaryLinks: NavigationLink[] = [
  { href: "/about", label: "About" },
  { href: "/team", label: "Team" },
  { href: "/members", label: "Members" },
  { href: "/news", label: "News" },
];

const programLinks: NavigationLink[] = [
  { href: "/programs/vex-u", label: "VEX U" },
  { href: "/programs/sidc", label: "SIDC" },
  { href: "/projects/roborowdy", label: "RoboRowdy" },
];

const exploreLinks: NavigationLink[] = [
  { href: "/events", label: "Events" },
  { href: "/media", label: "Media" },
  { href: "/constitution", label: "Constitution" },
  { href: "/sponsors", label: "Sponsors" },
  { href: "/impact", label: "Impact" },
  { href: "https://docs.210robotics.com", label: "Docs" },
];

const mainSiteUrl = "https://210robotics.com";
const mainSiteHref = (href: string) => href.startsWith("http") ? href : `${mainSiteUrl}${href}`;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<"programs" | "explore" | null>(null);
  const [customLinks, setCustomLinks] = useState<NavigationLink[]>([]);
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/site-navigation", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((value: unknown) => {
        if (!Array.isArray(value)) return;
        setCustomLinks(
          value.filter(
            (link): link is NavigationLink =>
              typeof link === "object" &&
              link !== null &&
              "href" in link &&
              "label" in link &&
              typeof link.href === "string" &&
              typeof link.label === "string",
          ),
        );
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Custom navigation could not be loaded", error);
      });
    return () => controller.abort();
  }, []);
  const displayedLinks = useMemo(
    () => [...primaryLinks, ...programLinks, ...exploreLinks, ...customLinks],
    [customLinks],
  );
  const active = (href: string) => {
    if (href.startsWith("http")) return false;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  useEffect(() => {
    function closeDropdown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpenDropdown(null);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenDropdown(null);
    }
    document.addEventListener("pointerdown", closeDropdown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeDropdown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);
  return (
    <header ref={headerRef} className="site-header sticky top-0 z-50 border-b border-[#272727] bg-black/90 backdrop-blur-xl">
      <div className="site-header-inner shell flex h-[74px] items-center gap-3">
        <Link
          href={mainSiteHref("/")}
          aria-label="210 Robotics home"
          className="group flex h-11 shrink-0 items-center gap-2"
        >
          <span className="relative block h-11 w-11 overflow-hidden bg-black">
            <Image src="/icon.png" alt="" fill sizes="44px" className="object-cover" priority />
          </span>
          <span className="hidden whitespace-nowrap text-sm font-bold tracking-[-.025em] text-white transition group-hover:text-[#fd7803] lg:block">210 ROBOTICS</span>
        </Link>
        <nav
          aria-label="Primary navigation"
          className="site-primary-nav hidden min-w-0 flex-1 items-center justify-center xl:flex"
        >
          {primaryLinks.map((link) => (
            <Link
              key={link.href}
              href={mainSiteHref(link.href)}
              className={cn(
                "site-nav-link",
                active(link.href) && "is-active",
              )}
            >
              {link.label}
            </Link>
          ))}
          <NavigationMenu
            active={programLinks.some((link) => active(link.href))}
            items={programLinks}
            label="Programs"
            open={openDropdown === "programs"}
            onOpenChange={(nextOpen) => setOpenDropdown(nextOpen ? "programs" : null)}
          />
          <NavigationMenu
            active={exploreLinks.some((link) => active(link.href))}
            items={[...exploreLinks, ...customLinks]}
            label="Explore"
            open={openDropdown === "explore"}
            onOpenChange={(nextOpen) => setOpenDropdown(nextOpen ? "explore" : null)}
          />
          <Link
            href={mainSiteHref("/donate")}
            className={cn("site-donate-link", active("/donate") && "is-active")}
          >
            <Heart aria-hidden="true" className="h-4 w-4" />
            Donate
          </Link>
        </nav>
        <div className="site-header-actions ml-auto flex shrink-0 items-center gap-2 xl:ml-0">
          <Link
            className="site-donate-compact xl:hidden"
            href={mainSiteHref("/donate")}
          >
            <Heart aria-hidden="true" className="h-4 w-4" />
            <span className="site-donate-label">Donate</span>
          </Link>
          <Link
            aria-label="Sign in or sign up for the 210 Robotics portal"
            className="button secondary !min-h-10 !px-3"
            href={mainSiteHref("/portal")}
          >
            <LogIn aria-hidden="true" className="h-4 w-4" />
            <span className="site-portal-label">Sign in / Sign up</span>
          </Link>
          <InquiryModal
            kind="join"
            label="Join 210"
            className="button !hidden !min-h-10 !px-3 2xl:!inline-flex"
          />
        </div>
        <button
          className="grid h-11 w-11 place-items-center border border-[#333] xl:hidden"
          aria-expanded={open}
          aria-label="Toggle menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X /> : <Menu />}
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full h-[calc(100dvh-74px)] border-t border-[#272727] bg-black/75 backdrop-blur-sm xl:hidden">
          <button
            aria-label="Close menu"
            className="absolute inset-0 h-full w-full cursor-default"
            onClick={() => setOpen(false)}
            type="button"
          />
          <div
            className="relative z-10 max-h-full overflow-y-auto bg-[#0b0b0b] shadow-2xl"
          >
            <nav className="shell py-4" aria-label="Mobile navigation">
              <div className="site-mobile-actions grid grid-cols-2 gap-3 border-b border-[#2b2b2b] pb-4">
                <Link
                  onClick={() => setOpen(false)}
                  className="button secondary"
                  href={mainSiteHref("/portal")}
                >
                  <LogIn aria-hidden="true" className="h-4 w-4" />
                  Sign in / Sign up
                </Link>
                <Link
                  onClick={() => setOpen(false)}
                  className="button"
                  href={mainSiteHref("/join")}
                >
                  Join 210
                </Link>
              </div>
              <div className="site-mobile-link-grid grid grid-cols-2 gap-x-3 py-2">
                {displayedLinks.map((link) => (
                  <Link
                    onClick={() => setOpen(false)}
                    key={link.href}
                    href={mainSiteHref(link.href)}
                    className={cn(
                      "border-b border-[#242424] px-1 py-3.5 text-[.72rem] font-bold uppercase tracking-[.08em] text-[#d8d8d8]",
                      pathname === link.href && "text-[#fd7803]",
                    )}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}

function NavigationMenu({
  active,
  items,
  label,
  open,
  onOpenChange,
}: {
  active: boolean;
  items: NavigationLink[];
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const menuId = `site-${label.toLowerCase()}-menu`;
  function moveFocus(direction: 1 | -1) {
    const links = [...(detailsRef.current?.querySelectorAll<HTMLAnchorElement>(".site-nav-dropdown a") || [])];
    if (!links.length) return;
    const current = links.indexOf(document.activeElement as HTMLAnchorElement);
    links[(current + direction + links.length) % links.length]?.focus();
  }
  return (
    <details ref={detailsRef} className="site-nav-menu" open={open}>
      <summary
        className={cn("site-nav-link", active && "is-active")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={(event) => {
          event.preventDefault();
          onOpenChange(!open);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            if (!open) onOpenChange(true);
            requestAnimationFrame(() => moveFocus(1));
          }
        }}
      >
        {label}
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5" />
      </summary>
      <div className="site-nav-dropdown" id={menuId} role="menu" aria-label={`${label} pages`}>
        {items.map((item) => (
          <Link href={mainSiteHref(item.href)} key={item.href} role="menuitem" onClick={() => onOpenChange(false)} onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); moveFocus(1); }
            if (event.key === "ArrowUp") { event.preventDefault(); moveFocus(-1); }
            if (event.key === "Escape") { event.preventDefault(); onOpenChange(false); detailsRef.current?.querySelector<HTMLElement>("summary")?.focus(); }
          }}>
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}
