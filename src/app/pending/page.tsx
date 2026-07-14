import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";

export default async function PendingPage(){const member=await getCurrentMember();return <section className="grid-bg min-h-[680px] py-24"><div className="shell"><div className="card mx-auto max-w-2xl p-9 md:p-12"><p className="eyebrow">Account review</p><h1 className="headline">Your account is waiting for approval.</h1><p className="lede mt-6">{member?.displayName ? `${member.displayName}, your` : "Your"} email is verified. A 210 Robotics admin must confirm membership and assign access before the portal opens.</p><Link className="button secondary mt-8" href="/">Return home</Link></div></div></section>}
