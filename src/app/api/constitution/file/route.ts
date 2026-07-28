import { get } from "@vercel/blob";
import { getPublishedConstitution } from "@/lib/constitution";
import { safeDocumentName } from "@/lib/internal-documents";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const constitution = await getPublishedConstitution();
  if (!constitution) {
    return Response.json(
      { error: "No constitution is currently published." },
      { status: 404 },
    );
  }
  const blob = await get(constitution.document.pathname, {
    access: "private",
    useCache: false,
    token: privateBlobToken(),
  });
  if (!blob || blob.statusCode !== 200) {
    return Response.json(
      { error: "The published constitution file was not found." },
      { status: 404 },
    );
  }
  const download = new URL(request.url).searchParams.get("download") === "1";
  return new Response(blob.stream, {
    headers: {
      "content-type": constitution.document.mimeType,
      "content-length": String(blob.blob.size),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${safeDocumentName(constitution.document.originalFilename)}"`,
      "cache-control": "public, max-age=300, stale-while-revalidate=3600",
      "x-content-type-options": "nosniff",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; img-src data: blob:",
    },
  });
}
