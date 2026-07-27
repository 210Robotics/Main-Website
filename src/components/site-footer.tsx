import Image from "next/image";
import Link from "next/link";
import { Code2, Globe2, Mail, Share2 } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer border-t border-[#282828] bg-[#070707]">
      <div className="shell grid gap-12 py-16 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <div className="relative h-14 w-48 overflow-hidden bg-black">
            <Image
              src="/icon.png"
              alt="210 Robotics"
              fill
              sizes="192px"
              className="object-cover object-left"
            />
          </div>
          <p className="mt-5 max-w-sm text-sm leading-7 text-[#999]">
            A student-led robotics organization at UT San Antonio, building
            ambitious machines and stronger engineers.
          </p>
        </div>
        <div>
          <p className="eyebrow">Explore</p>
          <div className="mt-5 grid gap-3 text-sm text-[#bbb]">
            <Link href="/members">Members</Link>
            <Link href="/news">News</Link>
            <Link href="/events">Events</Link>
            <Link href="/media">Media</Link>
            <Link href="/resources">Resources</Link>
            <Link href="/impact">Annual impact</Link>
          </div>
        </div>
        <div>
          <p className="eyebrow">Connect</p>
          <a
            className="mt-5 block text-sm text-[#bbb]"
            href="mailto:admin@210robotics.com"
          >
            admin@210robotics.com
          </a>
          <a
            className="mt-3 block text-sm text-[#bbb] transition hover:text-white"
            href="https://discord.gg/ZZXjwnzqv"
            target="_blank"
            rel="noreferrer"
          >
            Join our Discord
          </a>
          <div className="mt-6 flex gap-3">
            <a
              aria-label="Instagram"
              className="social-link"
              href="https://www.instagram.com/210_robotics/"
              target="_blank"
              rel="noreferrer"
            >
              <Share2 size={17} />
            </a>
            <a
              aria-label="LinkedIn"
              className="social-link"
              href="https://www.linkedin.com/company/210-robotics/"
              target="_blank"
              rel="noreferrer"
            >
              <Globe2 size={17} />
            </a>
            <a
              aria-label="GitHub"
              className="social-link"
              href="https://github.com/210-Robotics"
              target="_blank"
              rel="noreferrer"
            >
              <Code2 size={17} />
            </a>
            <a
              aria-label="Email"
              className="social-link"
              href="mailto:admin@210robotics.com"
            >
              <Mail size={17} />
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-[#242424]">
        <div className="shell flex flex-wrap justify-between gap-3 py-5 font-mono text-[.65rem] uppercase tracking-wider text-[#777]">
          <span>© 2026 210 Robotics</span>
          <span className="flex flex-wrap gap-x-4 gap-y-2">
            <Link className="transition hover:text-white" href="/privacy">
              Privacy
            </Link>
            <Link className="transition hover:text-white" href="/terms">
              Terms
            </Link>
            <span>Built by students. Driven by curiosity.</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
