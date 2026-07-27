import type { Metadata } from "next";
import { MediaGallery } from "@/components/media-gallery";
import { PageHero, SectionHeading } from "@/components/ui";
import { getPublicMedia } from "@/lib/content";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "Media" };

export default async function MediaPage({
  searchParams,
}: {
  searchParams: Promise<{ event?: string | string[] }>;
}) {
  const [media, content, query] = await Promise.all([
    getPublicMedia(),
    getWebsitePageContent("media"),
    searchParams,
  ]);
  const requestedEvent = Array.isArray(query.event) ? query.event[0] : query.event;
  return (
    <>
      <PageHero
        eyebrow={content.heroEyebrow}
        title={content.heroTitle}
        body={content.heroBody}
        image={content.heroImage}
      />
      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow={content.galleryEyebrow}
            title={content.galleryTitle}
            body={content.galleryBody}
          />
          <MediaGallery items={media} groupByEvent initialEventKey={requestedEvent || null} />
        </div>
      </section>
    </>
  );
}
