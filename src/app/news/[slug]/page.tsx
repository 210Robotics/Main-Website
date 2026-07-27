import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MediaGallery } from "@/components/media-gallery";
import { NewsEmbeds } from "@/components/news-embeds";
import { getPublicPost, getPublicPosts } from "@/lib/content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  return post
    ? {
        title: post.title,
        description: post.excerpt,
        openGraph: { images: [post.image] },
      }
    : { title: "Story not found" };
}

export async function generateStaticParams() {
  return (await getPublicPosts()).map((post) => ({ slug: post.slug }));
}

export default async function StoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublicPost(slug);
  if (!post) notFound();
  return (
    <article>
      <header className="relative min-h-[640px] overflow-hidden border-b border-[#333]">
        <Image
          src={post.image}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/50 to-black/20" />
        <div className="shell relative z-10 flex min-h-[640px] items-end py-20">
          <div className="max-w-4xl">
            <Link className="eyebrow" href="/news">
              News
            </Link>
            <h1 className="display mt-6">{post.title}</h1>
            <p className="lede mt-6">{post.excerpt}</p>
            <p className="mt-6 font-mono text-xs uppercase tracking-wider text-[#999]">
              {post.publishedAt.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      </header>
      <div
        className="article-body shell"
        dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
      />
      <NewsEmbeds urls={post.embedUrls} />
      {[
        ...new Set(post.gallery.map((item) => item.eventId || item.eventTitle)),
      ].map((eventKey) => {
        const gallery = post.gallery.filter(
          (item) => (item.eventId || item.eventTitle) === eventKey,
        );
        if (!gallery.length) return null;
        return (
          <section className="section border-t border-[#333]" key={eventKey}>
            <div className="shell">
              <p className="eyebrow">Event photos</p>
              <h2 className="mt-4 text-3xl font-bold">
                {gallery[0].eventTitle}
              </h2>
              {gallery[0].eventDescription && (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-[#999]">
                  {gallery[0].eventDescription}
                </p>
              )}
              <div className="mt-8">
                <MediaGallery
                  items={gallery}
                  layout="carousel"
                  showSharedFolderLink={false}
                />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border border-[#333] bg-[#0d0d0d] p-4 sm:p-5">
                <p className="text-sm text-[#aaa]">
                  Previewing all {gallery.length}{" "}
                  {gallery.length === 1 ? "photo" : "photos"} from this event.
                </p>
                <Link
                  className="button secondary"
                  href={`/media?event=${encodeURIComponent(gallery[0].eventId || gallery[0].eventTitle)}#event-gallery-panel`}
                >
                  View the full event gallery
                </Link>
              </div>
            </div>
          </section>
        );
      })}
    </article>
  );
}
