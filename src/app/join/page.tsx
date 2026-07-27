import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHero } from "@/components/ui";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Join" };

export default async function Join() {
  const content = await getWebsitePageContent("join");
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        image={content.heroImage}
      />
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[.75fr_1.25fr]">
          <div>
            <p className="eyebrow">{content.formEyebrow}</p>
            <h2 className="headline">{content.formTitle}</h2>
            <p className="lede mt-6">{content.formBody}</p>
            <div className="mt-9 space-y-4 text-sm text-[#999]">
              <p><strong className="text-white">Who can join?</strong><br />{content.whoAnswer}</p>
              <p><strong className="text-white">What does it cost?</strong><br />{content.costAnswer}</p>
              <p><strong className="text-white">What should I bring?</strong><br />{content.bringAnswer}</p>
            </div>
            <a
              className="button secondary mt-7 inline-flex"
              href="https://discord.gg/ZZXjwnzqv"
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={17} />
              Join the 210 Robotics Discord
            </a>
          </div>
          <InquiryForm kind="join" />
        </div>
      </section>
    </>
  );
}
