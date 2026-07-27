"use server";

import { randomUUID } from "node:crypto";
import { del, get, put } from "@vercel/blob";
import sharp from "sharp";
import { z } from "zod";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { isAllowedImageType, MAX_IMAGE_BYTES } from "@/lib/upload-policy";
import { privateBlobToken } from "@/lib/private-blob";

const uploadSchema = z.object({
  purpose: z.enum([
    "self-profile",
    "account-profile",
    "roster-card",
    "post-cover",
    "gallery-photo",
    "sponsor-logo",
    "site-content",
    "doc-image",
    "notebook-image",
    "form-image",
  ]),
  url: z.url(),
  pathname: z.string().min(10).max(600),
  filename: z.string().min(1).max(255),
  contentType: z.string().startsWith("image/"),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

export type FinalizedUpload = { id: string; url: string };

const notebookImageSchema = z.object({
  pathname: z.string().min(10).max(600),
  filename: z.string().min(1).max(255),
  contentType: z.string().startsWith("image/"),
  size: z.number().int().positive().max(MAX_IMAGE_BYTES),
});

export async function finalizeNotebookImageUpload(
  input: z.infer<typeof notebookImageSchema>,
) {
  const data = notebookImageSchema.parse(input);
  if (!isAllowedImageType(data.contentType))
    throw new Error("Unsupported image type.");
  const member = await requireActiveMember();
  if (
    !hasPermission(
      member.accessRole,
      "notebook.manage",
      member.permissionOverrides,
    )
  )
    throw new Error("You cannot upload notebook photos.");
  const prefix = `uploads/notebook-image/${member.id}/`;
  if (!data.pathname.startsWith(prefix))
    throw new Error("Upload ownership could not be verified.");
  const sourceBlob = await get(data.pathname, {
    access: "private",
    useCache: false,
    token: privateBlobToken(),
  });
  if (!sourceBlob || sourceBlob.statusCode !== 200)
    throw new Error("Uploaded image could not be read.");
  const source = Buffer.from(
    await new Response(sourceBlob.stream).arrayBuffer(),
  );
  if (source.byteLength > MAX_IMAGE_BYTES)
    throw new Error("Image is larger than 5 MB.");
  const processed = await sharp(source)
    .rotate()
    .resize({
      width: 2400,
      height: 2400,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 84 })
    .toBuffer();
  const pathname = `notebook-assets/${member.id}/${randomUUID()}.webp`;
  await put(pathname, processed, {
    access: "private",
    token: privateBlobToken(),
    contentType: "image/webp",
    addRandomSuffix: false,
  });
  try {
    await del(data.pathname, { token: privateBlobToken() });
  } catch (error) {
    console.error("Raw notebook photo cleanup failed", error);
  }
  return {
    pathname,
    url: `/api/notebook-assets?pathname=${encodeURIComponent(pathname)}`,
    filename: data.filename.replace(/\.[^.]+$/, "") + ".webp",
  };
}

export async function finalizeMediaUpload(input: z.infer<typeof uploadSchema>): Promise<FinalizedUpload> {
  const data = uploadSchema.parse(input);
  if (!isAllowedImageType(data.contentType)) throw new Error("Unsupported image type.");
  const member = await requireActiveMember();
  const permission = data.purpose === "account-profile"
    ? "members.edit"
    : data.purpose === "roster-card"
      ? "directory.manage"
    : data.purpose === "gallery-photo"
      ? "media.manage"
    : data.purpose === "post-cover" || data.purpose === "doc-image"
        ? "content.manage"
        : data.purpose === "notebook-image"
          ? "notebook.manage"
        : data.purpose === "site-content"
          ? null
        : data.purpose === "form-image"
          ? "forms.manage"
        : data.purpose === "sponsor-logo"
          ? "sponsors.manage"
          : null;
  const canFinalizeSiteContent =
    data.purpose !== "site-content" ||
    hasPermission(
      member.accessRole,
      "content.manage",
      member.permissionOverrides,
    ) ||
    hasPermission(
      member.accessRole,
      "finance.manage",
      member.permissionOverrides,
    );
  if (
    !canFinalizeSiteContent ||
    (permission &&
      !hasPermission(
        member.accessRole,
        permission,
        member.permissionOverrides,
      ))
  )
    throw new Error("You do not have permission to use this upload.");
  const prefix = `uploads/${data.purpose}/${member.id}/`;
  if (!data.pathname.startsWith(prefix)) throw new Error("Upload ownership could not be verified.");
  const sourceUrl = new URL(data.url);
  if (!sourceUrl.hostname.endsWith(".public.blob.vercel-storage.com"))
    throw new Error("Upload source is not a trusted Blob URL.");
  if (!decodeURIComponent(sourceUrl.pathname).includes(data.pathname))
    throw new Error("Upload path does not match its Blob URL.");
  const response = await fetch(sourceUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("Uploaded image could not be read.");
  const source = Buffer.from(await response.arrayBuffer());
  if (source.byteLength > MAX_IMAGE_BYTES) throw new Error("Image is larger than 5 MB.");
  const processed = await sharp(source)
    .rotate()
    .resize({ width: data.purpose === "post-cover" || data.purpose === "gallery-photo" || data.purpose === "doc-image" || data.purpose === "notebook-image" || data.purpose === "form-image" || data.purpose === "site-content" ? 2400 : 1600, height: 2400, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 84 })
    .toBuffer({ resolveWithObject: true });
  const pathname = `uploads/processed/${data.purpose}/${member.id}/${randomUUID()}.webp`;
  const blob = await put(pathname, processed.data, { access: "public", contentType: "image/webp", addRandomSuffix: false });
  const [asset] = await getDb().insert(mediaAssets).values({
    blobUrl: blob.url,
    pathname: blob.pathname,
    filename: data.filename.replace(/\.[^.]+$/, "") + ".webp",
    mimeType: "image/webp",
    width: processed.info.width,
    height: processed.info.height,
    bytes: processed.info.size,
    source: data.purpose,
    uploadedByMemberId: member.id,
    album:
      data.purpose === "gallery-photo"
        ? "Gallery upload"
      : data.purpose === "post-cover"
        ? "News"
        : data.purpose === "doc-image"
          ? "Documentation"
          : data.purpose === "notebook-image"
            ? "Engineering notebook"
          : data.purpose === "form-image"
            ? "Forms"
          : data.purpose === "site-content"
            ? "Website"
          : data.purpose === "sponsor-logo"
            ? "Sponsors"
            : "Profiles",
  }).returning({ id: mediaAssets.id });
  try { await del(data.pathname); } catch (error) { console.error("Raw upload cleanup failed", error); }
  return { id: asset.id, url: blob.url };
}
