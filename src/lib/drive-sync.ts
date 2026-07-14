import "server-only";
import { GoogleAuth } from "google-auth-library";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { and, inArray, isNotNull, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";

const folderMime = "application/vnd.google-apps.folder";
const imageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/tiff",
  "image/heic",
  "image/heif",
  "image/x-heic",
  "image/x-heif",
]);
const videoTypes = new Set(["video/mp4"]);
const allowed = new Set([...imageTypes, ...videoTypes]);
const maxImageBytes = 20 * 1024 * 1024;
const maxVideoBytes = 50 * 1024 * 1024;
const rootFolder =
  process.env.GOOGLE_DRIVE_PHOTO_FOLDER_ID ||
  "1IHg3ihyrWAotDgLh1_krBtgnKM5L6wXD";

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  size?: string;
  thumbnailUrl?: string;
};
type AlbumFile = DriveFile & { album: string };

export function hasDriveCredentials() {
  return Boolean(
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON ||
      (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
        process.env.GOOGLE_PRIVATE_KEY),
  );
}

function extension(name: string) {
  return name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function isSupported(file: DriveFile) {
  return (
    allowed.has(file.mimeType) ||
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".webp",
      ".avif",
      ".gif",
      ".tif",
      ".tiff",
      ".heic",
      ".heif",
      ".mp4",
    ].includes(extension(file.name))
  );
}

function isVideoFile(file: DriveFile) {
  return videoTypes.has(file.mimeType) || extension(file.name) === ".mp4";
}

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function getCredentials() {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    const decoded = serviceAccountJson.trim().startsWith("{")
      ? serviceAccountJson
      : Buffer.from(serviceAccountJson, "base64").toString("utf8");
    const credentials = JSON.parse(decoded) as {
      client_email?: string;
      private_key?: string;
    };
    if (credentials.client_email && credentials.private_key)
      return {
        client_email: credentials.client_email,
        private_key: credentials.private_key.replace(/\\n/g, "\n"),
      };
  }
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey)
    throw new Error("Google Drive service account credentials are not configured.");
  return { client_email: clientEmail, private_key: privateKey };
}

async function accessToken() {
  const auth = new GoogleAuth({
    credentials: getCredentials(),
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Google Drive access token could not be created.");
  return token.token;
}

async function listAuthenticatedFolder(folderId: string, token: string) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,modifiedTime,size)",
  });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!response.ok) throw new Error(`Drive list failed (${response.status}).`);
  return ((await response.json()) as { files?: DriveFile[] }).files ?? [];
}

async function walkAuthenticated(
  folderId: string,
  token: string,
  album = "Team photos",
): Promise<AlbumFile[]> {
  const entries = await listAuthenticatedFolder(folderId, token);
  const result: AlbumFile[] = [];
  for (const entry of entries) {
    if (entry.mimeType === folderMime)
      result.push(...(await walkAuthenticated(entry.id, token, entry.name)));
    else if (isSupported(entry)) result.push({ ...entry, album });
  }
  return result;
}

async function listPublicFolder(folderId: string): Promise<DriveFile[]> {
  const response = await fetch(
    `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folderId)}#grid`,
    { cache: "no-store", signal: AbortSignal.timeout(12_000) },
  );
  if (!response.ok)
    throw new Error(`The shared Drive folder is not publicly readable (${response.status}).`);
  const html = await response.text();
  const chunks = html.split('<div class="flip-entry" id="entry-').slice(1);
  return chunks.flatMap((chunk) => {
    const id = chunk.match(/^([^"]+)/)?.[1];
    const href = chunk.match(/<a href="([^"]+)"/)?.[1] ?? "";
    const title = chunk.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/)?.[1];
    if (!id || !title) return [];
    const folder = href.includes("/drive/folders/");
    const iconType = chunk.match(/drive-thirdparty\.googleusercontent\.com\/16\/type\/([^"?]+)/)?.[1];
    const thumbnailUrl = chunk.match(/flip-entry-thumb"><img src="([^"]+)"/)?.[1];
    return [
      {
        id,
        name: decodeHtml(title),
        mimeType: folder
          ? folderMime
          : decodeURIComponent(iconType ?? "application/octet-stream"),
        thumbnailUrl: thumbnailUrl?.replace(/&amp;/g, "&"),
      },
    ];
  });
}

async function walkPublic(
  folderId: string,
  album = "Team photos",
  visited = new Set<string>(),
): Promise<AlbumFile[]> {
  if (visited.has(folderId)) return [];
  visited.add(folderId);
  const entries = await listPublicFolder(folderId);
  const result: AlbumFile[] = [];
  for (const entry of entries) {
    if (entry.mimeType === folderMime)
      result.push(...(await walkPublic(entry.id, entry.name, visited)));
    else if (isSupported(entry)) result.push({ ...entry, album });
  }
  return result;
}

export async function syncDrivePhotos() {
  const token = hasDriveCredentials() ? await accessToken() : null;
  const files = token
    ? await walkAuthenticated(rootFolder, token)
    : await walkPublic(rootFolder);
  const seen = files.map((file) => file.id);
  const existingRows = seen.length
    ? await getDb()
        .select()
        .from(mediaAssets)
        .where(inArray(mediaAssets.driveFileId, seen))
    : [];
  const existingByDriveId = new Map(
    existingRows.map((asset) => [asset.driveFileId, asset]),
  );
  let imported = 0;
  let skipped = 0;

  async function processFile(file: AlbumFile) {
    try {
      const isVideo = isVideoFile(file);
      const sourceLimit = isVideo ? maxVideoBytes : maxImageBytes;
      if (Number(file.size || 0) > sourceLimit) {
        skipped++;
        return;
      }
      const existing = existingByDriveId.get(file.id);
      if (
        file.modifiedTime &&
        existing?.driveModifiedAt?.toISOString() ===
          new Date(file.modifiedTime).toISOString() &&
        !existing.archivedAt
      ) {
        skipped++;
        return;
      }

      const publicDownloadUrl = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(file.id)}&export=download&confirm=t`;
      const renderedHeifUrl =
        file.thumbnailUrl &&
        (file.mimeType.includes("heif") ||
          file.mimeType.includes("heic") ||
          [".heic", ".heif"].includes(extension(file.name)))
          ? file.thumbnailUrl.replace(/=s\d+$/, "=s2200")
          : null;
      const publicMetadata = token
        ? null
        : await fetch(publicDownloadUrl, {
            method: "HEAD",
            cache: "no-store",
            signal: AbortSignal.timeout(12_000),
          });
      if (publicMetadata && !publicMetadata.ok) {
        skipped++;
        return;
      }
      const metadataBytes = Number(
        publicMetadata?.headers.get("content-length") || file.size || 0,
      );
      if (metadataBytes > sourceLimit) {
        skipped++;
        return;
      }
      const modifiedAt = new Date(
        file.modifiedTime ||
          publicMetadata?.headers.get("last-modified") ||
          existing?.driveModifiedAt ||
          Date.now(),
      );
      if (
        existing?.driveModifiedAt?.toISOString() === modifiedAt.toISOString() &&
        !existing.archivedAt
      ) {
        skipped++;
        return;
      }

      const response = token
        ? await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`,
            {
              headers: { authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(20_000),
            },
          )
        : await fetch(renderedHeifUrl || publicDownloadUrl, {
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
          });
      if (!response.ok) {
        skipped++;
        return;
      }
      const responseBytes = Number(
        response.headers.get("content-length") || metadataBytes,
      );
      if (responseBytes > sourceLimit) {
        await response.body?.cancel();
        skipped++;
        return;
      }

      const version = modifiedAt.getTime();
      let pathname: string;
      let blobUrl: string;
      let mimeType: string;
      let width: number | undefined;
      let height: number | undefined;
      let bytes: number;

      if (isVideo) {
        if (!response.body) {
          skipped++;
          return;
        }
        pathname = `drive/${file.id}-${version}.mp4`;
        const blob = await put(pathname, response.body, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "video/mp4",
        });
        blobUrl = blob.url;
        mimeType = "video/mp4";
        bytes = Number(file.size || responseBytes || 0);
      } else {
        const original = Buffer.from(await response.arrayBuffer());
        if (original.length > maxImageBytes) {
          skipped++;
          return;
        }
        const image = sharp(original).rotate().resize({
          width: 2200,
          height: 2200,
          fit: "inside",
          withoutEnlargement: true,
        });
        const metadata = await image.metadata();
        const optimized = await image.webp({ quality: 84 }).toBuffer();
        pathname = `drive/${file.id}-${version}.webp`;
        const blob = await put(pathname, optimized, {
          access: "public",
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: "image/webp",
        });
        blobUrl = blob.url;
        mimeType = "image/webp";
        width = metadata.width;
        height = metadata.height;
        bytes = optimized.length;
      }
      const values = {
        driveFileId: file.id,
        driveModifiedAt: modifiedAt,
        blobUrl,
        pathname,
        filename: file.name,
        mimeType,
        alt: `210 Robotics — ${file.album}`,
        caption: "",
        album: file.album,
        width,
        height,
        bytes,
        published: true,
        archivedAt: null,
        updatedAt: new Date(),
      };
      await getDb()
        .insert(mediaAssets)
        .values(values)
        .onConflictDoUpdate({ target: mediaAssets.driveFileId, set: values });
      imported++;
    } catch (error) {
      console.error(`Drive media sync skipped ${file.id}`, error);
      skipped++;
    }
  }

  let nextFile = 0;
  async function worker() {
    while (nextFile < files.length) {
      const file = files[nextFile++];
      await processFile(file);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(12, files.length) }, () => worker()),
  );

  if (seen.length)
    await getDb()
      .update(mediaAssets)
      .set({ archivedAt: new Date(), published: false, updatedAt: new Date() })
      .where(
        and(
          isNotNull(mediaAssets.driveFileId),
          notInArray(mediaAssets.driveFileId, seen),
        ),
      );
  return { discovered: files.length, imported, skipped };
}
