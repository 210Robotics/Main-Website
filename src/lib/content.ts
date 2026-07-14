import "server-only";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { mediaAssets, posts } from "@/db/schema";
import { galleryImages, news } from "@/lib/site-data";

export type PublicPost = {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  image: string;
  publishedAt: Date;
};

export async function getPublicPosts(): Promise<PublicPost[]> {
  if (!hasDatabase()) return news.map((item, index) => ({ slug: item.slug, title: item.title, excerpt: item.summary, bodyHtml: `<p>${item.body}</p>`, image: item.image, publishedAt: new Date(2026, 5 + index, 15) }));
  const rows = await getDb().select().from(posts).where(and(eq(posts.status, "PUBLISHED"), lte(posts.publishedAt, new Date()))).orderBy(desc(posts.publishedAt));
  if (!rows.length) return news.map((item, index) => ({ slug: item.slug, title: item.title, excerpt: item.summary, bodyHtml: `<p>${item.body}</p>`, image: item.image, publishedAt: new Date(2026, 5 + index, 15) }));
  return rows.map((row) => ({ slug: row.slug, title: row.title, excerpt: row.excerpt, bodyHtml: row.bodyHtml, image: row.coverImageUrl || "/media/gallery/vexu/vexu-1.jpg", publishedAt: row.publishedAt || row.createdAt }));
}

export async function getPublicPost(slug: string) {
  return (await getPublicPosts()).find((post) => post.slug === slug) ?? null;
}

export type PublicMedia = { id: string; url: string; alt: string; caption: string; album: string };

export async function getPublicMedia(): Promise<PublicMedia[]> {
  if (!hasDatabase()) return galleryImages.map((url, index) => ({ id: String(index), url, alt: "210 Robotics students designing and building", caption: "Inside the 210 Robotics build process", album: index % 2 ? "RoboRowdy" : "Team workshop" }));
  const rows = await getDb().select().from(mediaAssets).where(and(eq(mediaAssets.published, true), isNull(mediaAssets.archivedAt))).orderBy(asc(mediaAssets.createdAt));
  return rows.length ? rows.map((row) => ({ id: row.id, url: row.blobUrl, alt: row.alt, caption: row.caption, album: row.album })) : galleryImages.map((url, index) => ({ id: String(index), url, alt: "210 Robotics students designing and building", caption: "Inside the 210 Robotics build process", album: "Team workshop" }));
}
