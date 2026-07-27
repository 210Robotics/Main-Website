import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { PageHero } from "@/components/ui";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms governing use of the 210 Robotics website, member portal, and Discord application.",
};

const sections = [
  {
    title: "Acceptance and eligibility",
    text: "By accessing the 210 Robotics website, member portal, Discord application, or related services, you agree to these terms. If you use the service on behalf of an organization, you represent that you have authority to do so. You must be at least 13 years old and meet any additional age requirements that apply where you live.",
  },
  {
    title: "Team accounts and access",
    text: "You are responsible for safeguarding your account and for activity performed through it. Team permissions are assigned according to organizational roles. Do not share access, impersonate another person, bypass permissions, or use another member’s credentials. Administrators may suspend, change, or remove access to protect team operations or when membership changes.",
  },
  {
    title: "Discord application",
    text: "The Discord application may link Discord identities to 210 Robotics accounts, register team commands, send account or calendar reminders, publish administrator-authorized messages, and collect server activity for internal records and analytics. Server administrators are responsible for enabling the application only in servers where they have authority and for informing members about applicable logging.",
  },
  {
    title: "Acceptable use",
    text: "You may not use the service to violate law; harass or harm others; distribute malware; obtain unauthorized access; expose private, confidential, export-controlled, or unsafe information; interfere with the service; scrape data without authorization; or misuse team, sponsor, donor, or member information. Robotics work must follow applicable competition, university, lab, and safety rules.",
  },
  {
    title: "Content and team records",
    text: "You retain ownership of content you submit. You grant 210 Robotics permission to host, reproduce, format, archive, and share that content as reasonably needed for team operations, documentation, competition submissions, public communications you authorize, and historical records. Do not upload content that you lack permission to use.",
  },
  {
    title: "Donations and third-party services",
    text: "Donations and payments are processed by third-party payment providers and may be subject to additional terms. Unless expressly stated by an authorized recipient, payments are not refundable and no tax treatment is guaranteed. Connected services such as Discord, Google, GitHub, Stripe, and authentication providers operate under their own terms and may change or become unavailable.",
  },
  {
    title: "Availability and disclaimers",
    text: "The service is provided on an “as available” basis for team and community use. To the extent permitted by law, 210 Robotics makes no warranties that the service will always be uninterrupted, error-free, secure, or suitable for a particular purpose. Information in the service does not replace professional legal, financial, safety, or engineering advice.",
  },
  {
    title: "Limitation and termination",
    text: "To the extent permitted by law, 210 Robotics and its members, officers, volunteers, and affiliates will not be liable for indirect, incidental, special, consequential, or exemplary damages arising from use of the service. We may restrict or terminate access, remove content, or discontinue features when reasonably necessary for safety, compliance, security, or team operations.",
  },
  {
    title: "Changes and contact",
    text: "We may revise these terms as the service evolves. Continued use after an updated effective date means you accept the revised terms. Questions may be sent to admin@210robotics.com.",
  },
];

export default function TermsOfServicePage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Service"
        body="The rules for using 210 Robotics online services and the connected Discord application."
      />
      <section className="section">
        <div className="shell">
          <div className="mx-auto max-w-4xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-[#333] bg-[#111] p-5">
              <span className="flex items-center gap-3 text-sm font-bold text-white">
                <FileCheck2 className="text-[#fd7803]" size={20} />
                210 Robotics service terms
              </span>
              <span className="font-mono text-xs uppercase tracking-wider text-[#888]">
                Effective July 26, 2026
              </span>
            </div>
            <div className="grid gap-5">
              {sections.map((section) => (
                <article className="card p-6 sm:p-8" key={section.title}>
                  <h2 className="text-xl font-bold text-white">{section.title}</h2>
                  <p className="mt-4 text-sm leading-7 text-[#aaa]">
                    {section.text}
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm leading-7 text-[#888]">
              Read the{" "}
              <Link className="text-[#fd7803] underline" href="/privacy">
                Privacy Policy
              </Link>{" "}
              for details about data collection, Discord message logging, and
              deletion requests.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
