import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CTA, PageHero } from "@/components/ui";
import type { CustomPage, CustomPageSection } from "@/lib/custom-pages";

function SectionCopy({ section }: { section: CustomPageSection }) {
  return (
    <div className="relative z-10">
      {section.eyebrow && <p className="eyebrow">{section.eyebrow}</p>}
      <h2 className="headline">{section.title}</h2>
      {section.body && (
        <p className="lede mt-6 whitespace-pre-line">{section.body}</p>
      )}
      {section.buttonLabel && section.buttonHref && (
        <Link className="button secondary mt-8" href={section.buttonHref}>
          {section.buttonLabel}
          <ArrowUpRight size={15} />
        </Link>
      )}
    </div>
  );
}

function CustomSection({
  section,
  index,
}: {
  section: CustomPageSection;
  index: number;
}) {
  const dark = index % 2 === 1;
  if (section.layout === "text-only" || !section.image) {
    return (
      <section
        className={`section ${dark ? "border-y border-[#282828] bg-[#0d0d0d]" : ""}`}
      >
        <div className="shell max-w-5xl">
          <SectionCopy section={section} />
        </div>
      </section>
    );
  }
  if (section.layout === "wide-image") {
    return (
      <section
        className={`section ${dark ? "border-y border-[#282828] bg-[#0d0d0d]" : ""}`}
      >
        <div className="shell">
          <div className="max-w-4xl">
            <SectionCopy section={section} />
          </div>
          <div className="relative mt-10 aspect-[16/7] min-h-72 overflow-hidden border border-[#333]">
            <Image
              src={section.image}
              alt=""
              fill
              sizes="(max-width: 1280px) 100vw, 1200px"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
          </div>
        </div>
      </section>
    );
  }
  const imageFirst = section.layout === "image-left";
  return (
    <section
      className={`section ${dark ? "border-y border-[#282828] bg-[#0d0d0d]" : ""}`}
    >
      <div className="shell grid items-center gap-12 lg:grid-cols-2">
        <div className={imageFirst ? "lg:order-2" : undefined}>
          <SectionCopy section={section} />
        </div>
        <div
          className={`relative h-[420px] overflow-hidden border border-[#333] ${imageFirst ? "lg:order-1" : undefined}`}
        >
          <Image
            src={section.image}
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
        </div>
      </div>
    </section>
  );
}

export function CustomPageRenderer({ page }: { page: CustomPage }) {
  return (
    <>
      <PageHero
        eyebrow={page.heroEyebrow}
        title={page.heroTitle}
        body={page.heroBody}
        image={page.heroImage || undefined}
      />
      {page.sections.map((section, index) => (
        <CustomSection key={section.id} section={section} index={index} />
      ))}
      {!page.sections.length && (
        <section className="section">
          <div className="shell">
            <p className="card p-7 text-sm text-[#999]">
              More information will be added soon.
            </p>
          </div>
        </section>
      )}
      {page.showJoinCta && <CTA />}
    </>
  );
}
