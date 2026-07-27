import type { Metadata } from "next";
import { InquiryForm } from "@/components/inquiry-form";
import { PageHero } from "@/components/ui";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Contact" };

export default async function Contact() {
  const content = await getWebsitePageContent("contact");
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
      />
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[.7fr_1.3fr]">
          <div>
            <p className="eyebrow">{content.contactEyebrow}</p>
            <h2 className="headline">{content.contactTitle}</h2>
            <p className="lede mt-6">{content.contactBody}</p>
            <a className="mt-8 inline-block text-[#fd7803]" href={`mailto:${content.contactEmail}`}>
              {content.contactEmail}
            </a>
          </div>
          <InquiryForm />
        </div>
      </section>
    </>
  );
}
