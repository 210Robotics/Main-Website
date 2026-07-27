import { get } from "@vercel/blob";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { internalDocuments } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { safeDocumentName } from "@/lib/internal-documents";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const actor = await requireActiveMember();
  if (
    !hasPermission(
      actor.accessRole,
      "documents.manage",
      actor.permissionOverrides,
    )
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const [document] = await getDb()
    .select()
    .from(internalDocuments)
    .where(eq(internalDocuments.id, id))
    .limit(1);
  if (!document || document.archivedAt)
    return Response.json({ error: "Document not found." }, { status: 404 });
  const blob = await get(document.pathname, {
    access: "private",
    useCache: false,
    token: privateBlobToken(),
  });
  if (!blob || blob.statusCode !== 200)
    return Response.json({ error: "Document file not found." }, { status: 404 });
  const download = new URL(request.url).searchParams.get("download") === "1";
  const disposition = download ? "attachment" : "inline";
  return new Response(blob.stream, {
    headers: {
      "content-type": document.mimeType,
      "content-length": String(blob.blob.size),
      "content-disposition": `${disposition}; filename="${safeDocumentName(document.originalFilename)}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
