import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "How 210 Robotics collects, uses, protects, and removes information across its website, member portal, and Discord integration.",
};

const sections = [
  {
    title: "Information we collect",
    body: (
      <>
        <p>
          We collect information that members, volunteers, donors, sponsors,
          and visitors provide to us, including names, contact information,
          account details, form responses, attendance, team activity,
          contributions, uploaded files, and payment records. Payment card
          details are processed by Stripe and are not stored by 210 Robotics.
        </p>
        <p>
          When a member connects Discord, our application may receive their
          Discord user ID, username, display name, server roles, membership
          status, and account-link status. In team servers where administrators
          enable message logging, the application may also store message
          content, channel information, timestamps, attachments or links, and
          message activity needed for team records and analytics. Direct
          messages are used only for requested account-linking and team
          reminders.
        </p>
      </>
    ),
  },
  {
    title: "How we use information",
    body: (
      <>
        <p>
          We use information to operate the team, authenticate users, manage
          permissions, coordinate projects and events, track participation,
          maintain engineering and administrative records, process donations,
          communicate reminders, provide member tools, prevent misuse, and
          improve our programs.
        </p>
        <p>
          Discord data is used to connect member identities, deliver calendar
          and registration reminders, support authorized announcements, show
          team participation analytics, and maintain an administrative message
          archive. We do not sell personal information or use Discord data for
          advertising.
        </p>
      </>
    ),
  },
  {
    title: "Sharing and service providers",
    body: (
      <p>
        We share information only when needed to operate the service, comply
        with law, protect the team, or honor a user&apos;s request. Our service
        providers may include Discord, Clerk, Google, GitHub, Neon, Stripe,
        Vercel, and other tools selected by team administrators. Their handling
        of information is governed by their own policies and our configurations.
      </p>
    ),
  },
  {
    title: "Storage, retention, and security",
    body: (
      <p>
        We use reasonable administrative and technical safeguards to protect
        information. Records are retained for as long as they support team
        operations, legal or financial obligations, safety, historical
        documentation, or legitimate program needs. Administrators may delete
        or anonymize records when they are no longer needed. No online system
        can guarantee absolute security.
      </p>
    ),
  },
  {
    title: "Your choices and data requests",
    body: (
      <p>
        You may request access, correction, account disconnection, or deletion
        of your personal information by emailing{" "}
        <a className="text-[#fd7803] underline" href="mailto:admin@210robotics.com">
          admin@210robotics.com
        </a>
        . Include enough information for us to identify the relevant account.
        Some records may be retained when required for legal, safety, financial,
        or legitimate organizational purposes. You may also leave the Discord
        server or revoke the application through Discord settings.
      </p>
    ),
  },
  {
    title: "Children and student participation",
    body: (
      <p>
        The service supports a university robotics organization and is not
        directed to children under 13. If we learn that information from a
        child under 13 was collected without appropriate authorization, we
        will take reasonable steps to remove it.
      </p>
    ),
  },
  {
    title: "Policy updates and contact",
    body: (
      <p>
        We may update this policy as our services change. The effective date
        below will identify the latest revision. Questions or privacy requests
        may be sent to{" "}
        <a className="text-[#fd7803] underline" href="mailto:admin@210robotics.com">
          admin@210robotics.com
        </a>
        . You can also review our{" "}
        <Link className="text-[#fd7803] underline" href="/terms">
          Terms of Service
        </Link>
        .
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        body="How 210 Robotics handles information across the public website, member portal, and connected team services."
      />
      <section className="section">
        <div className="shell">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#333] bg-[#111] p-5">
              <span className="flex items-center gap-3 text-sm font-bold text-white">
                <ShieldCheck className="text-[#fd7803]" size={20} />
                210 Robotics privacy notice
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-[#888]">
                Effective July 26, 2026
              </span>
            </div>
            <div className="grid gap-5">
              {sections.map((section) => (
                <article className="card p-6 sm:p-8" key={section.title}>
                  <h2 className="text-xl font-bold text-white">{section.title}</h2>
                  <div className="mt-4 grid gap-4 text-sm leading-7 text-[#aaa]">
                    {section.body}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
