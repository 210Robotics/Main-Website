import "server-only";

import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { internalDocuments, publicSettings } from "@/db/schema";

export async function getPublishedConstitution() {
  const [row] = await getDb()
    .select({
      document: internalDocuments,
      version: publicSettings.constitutionVersion,
      effectiveDate: publicSettings.constitutionEffectiveDate,
      publishedAt: publicSettings.constitutionPublishedAt,
    })
    .from(publicSettings)
    .innerJoin(
      internalDocuments,
      eq(publicSettings.constitutionDocumentId, internalDocuments.id),
    )
    .where(
      and(
        eq(publicSettings.id, "site"),
        isNull(internalDocuments.archivedAt),
      ),
    )
    .limit(1);
  return row || null;
}
