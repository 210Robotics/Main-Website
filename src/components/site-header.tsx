"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { InquiryModal } from "@/components/inquiry-form";

const links = [
  { href: "/about", label: "About" },
  { href: "/programs/vex-u", label: "VEX U" },
  { href: "/programs/sidc", label: "SIDC" },
  { href: "/team", label: "Team" },
  { href: "/news", label: "News" },
  { href: "/events", label: "Events" },
  { href: "/media", label: "Media" },
  { href: "/sponsors", label: "Sponsors" },
];

export function SiteHeader() {
  const [open,setOpen] = useState(false);
  const pathname = usePathname();
  return <header className="sticky top-0 z-50 border-b border-[#272727] bg-black/90 backdrop-blur-xl">
    <div className="shell flex h-[74px] items-center justify-between gap-6">
      <Link href="/" aria-label="210 Robotics home" className="relative block h-10 w-[150px] shrink-0">
        <Image src="/media/brand/210-banner.png" alt="210 Robotics" fill sizes="150px" className="object-contain object-left" priority />
      </Link>
      <nav aria-label="Primary navigation" className="hidden items-center gap-5 xl:flex">
        {links.map(link => <Link key={link.href} href={link.href} className={cn("text-[.7rem] font-bold uppercase tracking-[.09em] text-[#bbb] transition hover:text-white",pathname===link.href&&"text-[#fd7803]")}>{link.label}</Link>)}
      </nav>
      <div className="hidden items-center gap-3 sm:flex">
        <Link className="button secondary !min-h-10 !px-3" href="/sign-in">Portal</Link>
        <InquiryModal kind="join" label="Join 210" className="button !min-h-10 !px-3"/>
      </div>
      <button className="grid h-11 w-11 place-items-center border border-[#333] xl:hidden" aria-expanded={open} aria-label="Toggle menu" onClick={()=>setOpen(v=>!v)}>{open?<X/>:<Menu/>}</button>
    </div>
    {open && <div className="border-t border-[#272727] bg-[#0b0b0b] xl:hidden"><nav className="shell grid py-4" aria-label="Mobile navigation">
      {links.map(link=><Link onClick={()=>setOpen(false)} key={link.href} href={link.href} className="border-b border-[#242424] py-4 text-sm font-bold uppercase tracking-wider">{link.label}</Link>)}
      <div className="grid grid-cols-2 gap-3 pt-5"><Link onClick={()=>setOpen(false)} className="button secondary" href="/sign-in">Portal</Link><Link onClick={()=>setOpen(false)} className="button" href="/join">Join 210</Link></div>
    </nav></div>}
  </header>;
}
