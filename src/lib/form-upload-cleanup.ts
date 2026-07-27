import "server-only";

import { del } from "@vercel/blob";
import { and, inArray, isNull, lt } from "drizzle-orm";
import { getDb } from "@/db";
import { publicFormUploads } from "@/db/schema";

export async function cleanupAbandonedFormUploads(limit = 50) {
  const abandoned = await getDb().select({ id: publicFormUploads.id, pathname: publicFormUploads.pathname }).from(publicFormUploads).where(and(
    isNull(publicFormUploads.claimedAt),
    lt(publicFormUploads.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
  )).limit(limit);
  if (!abandoned.length) return { removed: 0 };
  await del(abandoned.map((upload) => upload.pathname));
  await getDb().delete(publicFormUploads).where(inArray(publicFormUploads.id, abandoned.map((upload) => upload.id)));
  return { removed: abandoned.length };
}
