import "server-only";

import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { publicSettings } from "@/db/schema";
import {
  resolveWebsitePageContent,
  type WebsiteContentMap,
} from "@/lib/site-content-schema";
import {
  sortCustomPages,
  type CustomPage,
} from "@/lib/custom-pages";

export async function getWebsiteContentOverrides(): Promise<WebsiteContentMap> {
  if (!hasDatabase()) return {};
  try {
    const [settings] = await getDb()
      .select({ pageContent: publicSettings.pageContent })
      .from(publicSettings)
      .where(eq(publicSettings.id, "site"))
      .limit(1);
    return settings?.pageContent ?? {};
  } catch (error) {
    console.error("Website content overrides could not be loaded", error);
    return {};
  }
}

export async function getWebsitePageContent(pageId: string) {
  return resolveWebsitePageContent(pageId, await getWebsiteContentOverrides());
}

export async function getCustomPages(): Promise<CustomPage[]> {
  if (!hasDatabase()) return [];
  try {
    const [settings] = await getDb()
      .select({ customPages: publicSettings.customPages })
      .from(publicSettings)
      .where(eq(publicSettings.id, "site"))
      .limit(1);
    return sortCustomPages(settings?.customPages ?? []);
  } catch (error) {
    console.error("Custom website pages could not be loaded", error);
    return [];
  }
}

export async function getPublishedCustomPages() {
  return (await getCustomPages()).filter(
    (page) => page.status === "PUBLISHED",
  );
}

export async function getCustomPageBySlug(slug: string) {
  return (await getPublishedCustomPages()).find((page) => page.slug === slug);
}
