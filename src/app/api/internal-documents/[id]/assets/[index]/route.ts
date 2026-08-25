import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { internalDocuments } from "@/db/schema";
import { requireMemberEntitlement } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; index: string }> },
) {
  const actor = await requireMemberEntitlement();
  const allowed =
    hasPermission(
      actor.accessRole,
      "documents.manage",
      actor.permissionOverrides,
    ) ||
    hasPermission(
      actor.accessRole,
      "notebook.view",
      actor.permissionOverrides,
    );
  if (!allowed) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id, index: rawIndex } = await params;
  const index = Number(rawIndex);
  if (!Number.isSafeInteger(index) || index < 0)
    return Response.json({ error: "Asset not found." }, { status: 404 });
  const [document] = await getDb()
    .select({
      archivedAt: internalDocuments.archivedAt,
      embeddedAssets: internalDocuments.embeddedAssets,
    })
    .from(internalDocuments)
    .where(eq(internalDocuments.id, id))
    .limit(1);
  const asset = document?.embeddedAssets[index];
  if (!document || document.archivedAt || !asset)
    return Response.json({ error: "Asset not found." }, { status: 404 });
  const blob = await get(asset.pathname, {
    access: "private",
    token: privateBlobToken(),
  });
  if (!blob || blob.statusCode !== 200)
    return Response.json({ error: "Asset not found." }, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "content-type": asset.mimeType,
      "content-length": String(blob.blob.size),
      "cache-control": "private, max-age=300",
      "content-disposition": `inline; filename="${asset.filename.replace(/["\\]/g, "-")}"`,
      "x-content-type-options": "nosniff",
    },
  });
}
