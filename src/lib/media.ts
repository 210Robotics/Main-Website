import "server-only";

import { del } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets, members, posts, publicProfileCards, sponsors } from "@/db/schema";

export async function cleanupMediaIfUnused(id: string | null | undefined) {
  if (!id) return;
  const [memberRef, postRef, cardRef, sponsorRef] = await Promise.all([
    getDb().select({ id: members.id }).from(members).where(eq(members.photoMediaId, id)).limit(1),
    getDb().select({ id: posts.id }).from(posts).where(eq(posts.coverMediaId, id)).limit(1),
    getDb().select({ id: publicProfileCards.id }).from(publicProfileCards).where(eq(publicProfileCards.photoMediaId, id)).limit(1),
    getDb().select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.logoMediaId, id)).limit(1),
  ]);
  if (memberRef.length || postRef.length || cardRef.length || sponsorRef.length) return;
  const [asset] = await getDb()
    .select({ pathname: mediaAssets.pathname, source: mediaAssets.source })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, id))
    .limit(1);
  if (!asset || asset.source === "drive") return;
  await getDb().delete(mediaAssets).where(eq(mediaAssets.id, id));
  try {
    await del(asset.pathname);
  } catch (error) {
    console.error("Orphaned Blob cleanup failed", error);
  }
}
