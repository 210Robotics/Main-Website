import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowUpRight } from "lucide-react";
import { PageHero, SectionHeading } from "@/components/ui";
import { getPublicPosts } from "@/lib/content";
import { getWebsitePageContent } from "@/lib/site-content";

export const metadata: Metadata = { title: "News" };

export default async function NewsPage() {
  const [posts, content] = await Promise.all([
    getPublicPosts(),
    getWebsitePageContent("news"),
  ]);
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
            eyebrow={content.storiesEyebrow}
            title={content.storiesTitle}
          />
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {posts.map((post) => (
              <Link
                href={`/news/${post.slug}`}
                className="group card overflow-hidden"
                key={post.slug}
              >
                <div className="relative h-56 overflow-hidden">
                  <Image
                    src={post.image}
                    alt=""
                    fill
                    sizes="(max-width: 900px) 100vw, 33vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                </div>
                <div className="p-6">
                  <p className="font-mono text-[.65rem] uppercase tracking-wider text-[#fd7803]">
                    {post.publishedAt.toLocaleDateString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                  <div className="mt-3 flex items-start justify-between gap-3">
                    <h2 className="text-xl font-bold leading-7">{post.title}</h2>
                    <ArrowUpRight className="shrink-0 text-[#fd7803] transition group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#999]">{post.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
