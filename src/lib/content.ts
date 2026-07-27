import "server-only";
import { and, asc, desc, eq, isNull, lte } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import {
  galleryEvents,
  mediaAssets,
  members,
  posts,
  publicSettings,
  sponsors,
} from "@/db/schema";
import { GALLERY_MEDIA_SOURCE } from "@/lib/media-policy";
import {
  galleryImages,
  news,
  sponsors as fallbackSponsors,
} from "@/lib/site-data";

export type PublicSponsor = {
  id: string;
  name: string;
  image: string;
  sponsorship: string;
  tier: string;
  websiteUrl: string | null;
};

export async function getPublicSponsors(): Promise<PublicSponsor[]> {
  if (!hasDatabase())
    return fallbackSponsors.map((sponsor, index) => ({
      id: `fallback-${index}`,
      name: sponsor.name,
      image: sponsor.image,
      sponsorship: sponsor.kind,
      tier: "Partner",
      websiteUrl: null,
    }));
  try {
    const rows = await getDb()
      .select({ sponsor: sponsors, logoUrl: mediaAssets.blobUrl })
      .from(sponsors)
      .leftJoin(mediaAssets, eq(mediaAssets.id, sponsors.logoMediaId))
      .where(eq(sponsors.published, true))
      .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));
    return rows.map(({ sponsor, logoUrl }) => ({
      id: sponsor.id,
      name: sponsor.name,
      image: logoUrl || sponsor.logoUrl || "/icon.svg",
      sponsorship: sponsor.sponsorship,
      tier: sponsor.tier,
      websiteUrl: sponsor.websiteUrl,
    }));
  } catch (error) {
    console.error("Public sponsors could not be loaded", error);
    return fallbackSponsors.map((sponsor, index) => ({
      id: `fallback-${index}`,
      name: sponsor.name,
      image: sponsor.image,
      sponsorship: sponsor.kind,
      tier: "Partner",
      websiteUrl: null,
    }));
  }
}

export type PublicPost = {
  slug: string;
  title: string;
  excerpt: string;
  bodyHtml: string;
  image: string;
  publishedAt: Date;
  gallery: PublicMedia[];
  embedUrls: string[];
};

export async function getPublicPosts(): Promise<PublicPost[]> {
  if (!hasDatabase())
    return news.map((item, index) => ({
      slug: item.slug,
      title: item.title,
      excerpt: item.summary,
      bodyHtml: `<p>${item.body}</p>`,
      image: item.image,
      publishedAt: new Date(2026, 5 + index, 15),
      gallery: [],
      embedUrls: [],
    }));
  const rows = await getDb()
    .select({ post: posts, coverUrl: mediaAssets.blobUrl })
    .from(posts)
    .leftJoin(mediaAssets, eq(mediaAssets.id, posts.coverMediaId))
    .where(
      and(eq(posts.status, "PUBLISHED"), lte(posts.publishedAt, new Date())),
    )
    .orderBy(desc(posts.publishedAt));
  if (!rows.length)
    return news.map((item, index) => ({
      slug: item.slug,
      title: item.title,
      excerpt: item.summary,
      bodyHtml: `<p>${item.body}</p>`,
      image: item.image,
      publishedAt: new Date(2026, 5 + index, 15),
      gallery: [],
      embedUrls: [],
    }));
  const publicMedia = await getPublicMedia();
  return rows.map(({ post, coverUrl }) => ({
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    bodyHtml: post.bodyHtml,
    image: coverUrl || post.coverImageUrl || "/media/gallery/vexu/vexu-1.jpg",
    publishedAt: post.publishedAt || post.createdAt,
    gallery: publicMedia.filter((item) =>
      (post.galleryEventIds.length
        ? post.galleryEventIds
        : post.galleryEventId
          ? [post.galleryEventId]
          : []
      ).includes(item.eventId || ""),
    ),
    embedUrls: post.embedUrls,
  }));
}

export async function getPublicPost(slug: string) {
  return (await getPublicPosts()).find((post) => post.slug === slug) ?? null;
}

export async function getPublicMemberCount() {
  if (!hasDatabase()) return 12;
  const [activeRows, settingRows] = await Promise.all([
    getDb()
      .select({ id: members.id })
      .from(members)
      .where(eq(members.status, "ACTIVE")),
    getDb()
      .select()
      .from(publicSettings)
      .where(eq(publicSettings.id, "site"))
      .limit(1),
  ]);
  const setting = settingRows[0];
  if (
    setting?.memberCountOverrideEnabled &&
    setting.memberCountOverride !== null
  )
    return setting.memberCountOverride;
  return Math.max(activeRows.length, 12);
}

export type PublicMedia = {
  id: string;
  url: string;
  alt: string;
  caption: string;
  album: string;
  mediaType: "image" | "video";
  eventId: string | null;
  eventTitle: string;
  eventDescription: string;
  eventDate: Date | null;
  eventDriveFolderId: string | null;
};

export async function getPublicMedia(): Promise<PublicMedia[]> {
  if (!hasDatabase())
    return galleryImages.map((url, index) => ({
      id: String(index),
      url,
      alt: "210 Robotics students designing and building",
      caption: "Inside the 210 Robotics build process",
      album: index % 2 ? "RoboRowdy" : "Team workshop",
      mediaType: "image",
      eventId: null,
      eventTitle: index % 2 ? "RoboRowdy" : "Team workshop",
      eventDescription: "",
      eventDate: null,
      eventDriveFolderId: null,
    }));
  const rows = await getDb()
    .select({ asset: mediaAssets, event: galleryEvents })
    .from(mediaAssets)
    .leftJoin(galleryEvents, eq(mediaAssets.galleryEventId, galleryEvents.id))
    .where(
      and(
        eq(mediaAssets.source, GALLERY_MEDIA_SOURCE),
        eq(mediaAssets.published, true),
        isNull(mediaAssets.archivedAt),
      ),
    )
    .orderBy(asc(mediaAssets.createdAt));
  return rows.length
    ? rows
        .filter(
          ({ asset, event }) =>
            !asset.galleryEventId ||
            Boolean(event?.published && !event.archivedAt),
        )
        .map(({ asset, event }) => ({
          id: asset.id,
          url: asset.blobUrl,
          alt: asset.alt,
          caption: asset.caption,
          album: event?.title || asset.album,
          mediaType: asset.mimeType.startsWith("video/")
            ? ("video" as const)
            : ("image" as const),
          eventId: event?.id || null,
          eventTitle: event?.title || asset.album,
          eventDescription: event?.description || "",
          eventDate: event?.eventDate || null,
          eventDriveFolderId: event?.driveFolderId || null,
        }))
    : galleryImages.map((url, index) => ({
        id: String(index),
        url,
        alt: "210 Robotics students designing and building",
        caption: "Inside the 210 Robotics build process",
        album: "Team workshop",
        mediaType: "image",
        eventId: null,
        eventTitle: "Team workshop",
        eventDescription: "",
        eventDate: null,
        eventDriveFolderId: null,
      }));
}
