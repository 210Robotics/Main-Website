import Link from "next/link";
import { getCurrentMember } from "@/lib/auth";

export default async function PendingPage() {
  const member = await getCurrentMember();
  return (
    <section className="grid-bg min-h-[680px] py-24">
      <div className="shell">
        <div className="card mx-auto max-w-2xl p-9 md:p-12">
          <p className="eyebrow">Account review</p>
          <h1 className="headline">Finish your membership verification.</h1>
          <p className="lede mt-6">
            {member?.displayName ? `${member.displayName}, your` : "Your"} account is safe. Complete the verification checklist so officers can approve any exceptions and provision Discord access.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button" href="/verify">Open verification checklist</Link>
            <Link className="button secondary" href="/">Return home</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
