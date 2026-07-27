import { get } from "@vercel/blob";
import { requireActiveMember } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { privateBlobToken } from "@/lib/private-blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await requireActiveMember();
  if (
    !hasPermission(
      actor.accessRole,
      "notebook.view",
      actor.permissionOverrides,
    )
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const pathname = new URL(request.url).searchParams.get("pathname") || "";
  if (
    pathname.length > 600 ||
    !pathname.startsWith("notebook-assets/") ||
    pathname.includes("..")
  )
    return Response.json({ error: "Asset not found." }, { status: 404 });
  const blob = await get(pathname, {
    access: "private",
    token: privateBlobToken(),
  });
  if (
    !blob ||
    blob.statusCode !== 200 ||
    !blob.blob.contentType.startsWith("image/")
  )
    return Response.json({ error: "Asset not found." }, { status: 404 });
  return new Response(blob.stream, {
    headers: {
      "content-type": blob.blob.contentType,
      "content-length": String(blob.blob.size),
      "cache-control": "private, max-age=300",
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
