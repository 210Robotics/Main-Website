import type { Metadata } from "next";
import { ArrowUpRight, BookOpen, LockKeyhole, ScrollText } from "lucide-react";
import Link from "next/link";
import { PageHero, SectionHeading } from "@/components/ui";
import { resourceLinks } from "@/lib/site-data";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Resources" };

export default async function Resources() {
  const content = await getWebsitePageContent("resources");
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
      />
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow={content.libraryEyebrow}
            title={content.libraryTitle}
            body={content.libraryBody}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <Link
              href="/constitution"
              className="group card border-[#4b321f] bg-[#130f0c] p-7 transition hover:-translate-y-1 hover:border-[#fd7803]/70"
            >
              <div className="flex items-center justify-between">
                <ScrollText className="text-[#fd7803]" />
                <ArrowUpRight className="text-[#666] transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#fd7803]" />
              </div>
              <p className="eyebrow mt-8">Organization governance</p>
              <h2 className="mt-4 text-2xl font-bold">
                210 Robotics Constitution
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#999]">
                Read or download the latest approved constitution governing
                membership, leadership, and team operations.
              </p>
            </Link>
            {resourceLinks.map((resource) => (
              <a
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="group card p-7 transition hover:-translate-y-1 hover:border-[#fd7803]/60"
                key={resource.title}
              >
                <div className="flex items-center justify-between">
                  <BookOpen className="text-[#fd7803]" />
                  <ArrowUpRight className="text-[#666] transition group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-[#fd7803]" />
                </div>
                <p className="eyebrow mt-8">{resource.category}</p>
                <h2 className="mt-4 text-2xl font-bold">{resource.title}</h2>
                <p className="mt-4 text-sm leading-7 text-[#999]">{resource.description}</p>
              </a>
            ))}
          </div>
          <div className="mt-8 flex items-center gap-3 border border-[#333] p-5 text-sm text-[#999]">
            <LockKeyhole className="text-[#fd7803]" size={19} />
            {content.privateNote}
          </div>
        </div>
      </section>
    </>
  );
}
