import "server-only";
import { GoogleAuth } from "google-auth-library";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { and, eq, isNotNull, notInArray } from "drizzle-orm";
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
const rootFolder = process.env.GOOGLE_DRIVE_PHOTO_FOLDER_ID || "1IHg3ihyrWAotDgLh1_krBtgnKM5L6wXD";

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; parents?: string[] };

function extension(name: string) {
  return name.toLowerCase().match(/\.[^.]+$/)?.[0] ?? "";
}

function isSupported(file: DriveFile) {
  return allowed.has(file.mimeType) || [".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tif", ".tiff", ".heic", ".heif", ".mp4"].includes(extension(file.name));
}

function isVideoFile(file: DriveFile) {
  return videoTypes.has(file.mimeType) || extension(file.name) === ".mp4";
}

function getCredentials() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) throw new Error("Google Drive service account credentials are not configured.");
  return { client_email: clientEmail, private_key: privateKey };
}

async function accessToken() {
  const auth = new GoogleAuth({ credentials: getCredentials(), scopes: ["https://www.googleapis.com/auth/drive.readonly"] });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Google Drive access token could not be created.");
  return token.token;
}

async function listFolder(folderId: string, token: string): Promise<DriveFile[]> {
  const params = new URLSearchParams({ q: `'${folderId}' in parents and trashed = false`, pageSize: "1000", supportsAllDrives: "true", includeItemsFromAllDrives: "true", fields: "files(id,name,mimeType,modifiedTime,size,parents)" });
  const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Drive list failed (${response.status}).`);
  return (await response.json() as { files?: DriveFile[] }).files ?? [];
}

async function walk(folderId: string, token: string, album = "Team photos"): Promise<Array<DriveFile & { album: string }>> {
  const entries = await listFolder(folderId, token);
  const result: Array<DriveFile & { album: string }> = [];
  for (const entry of entries) {
    if (entry.mimeType === folderMime) result.push(...await walk(entry.id, token, entry.name));
    else if (isSupported(entry)) result.push({ ...entry, album });
  }
  return result;
}

export async function syncDrivePhotos() {
  const token = await accessToken();
  const files = await walk(rootFolder, token);
  const seen: string[] = [];
  let imported = 0;
  let skipped = 0;
  for (const file of files) {
    seen.push(file.id);
    try {
      const isVideo = isVideoFile(file);
      const sourceLimit = isVideo ? maxVideoBytes : maxImageBytes;
      if (Number(file.size || 0) > sourceLimit) { skipped++; continue; }
      const [existing] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.driveFileId, file.id)).limit(1);
      if (existing?.driveModifiedAt?.toISOString() === new Date(file.modifiedTime || 0).toISOString() && !existing.archivedAt) { skipped++; continue; }
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) { skipped++; continue; }
      const version = new Date(file.modifiedTime || Date.now()).getTime();
      let pathname: string;
      let blobUrl: string;
      let mimeType: string;
      let width: number | undefined;
      let height: number | undefined;
      let bytes: number;

      if (isVideo) {
        if (!response.body) { skipped++; continue; }
        pathname = `drive/${file.id}-${version}.mp4`;
        const blob = await put(pathname, response.body, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "video/mp4" });
        blobUrl = blob.url;
        mimeType = "video/mp4";
        bytes = Number(file.size || response.headers.get("content-length") || 0);
      } else {
        const original = Buffer.from(await response.arrayBuffer());
        if (original.length > maxImageBytes) { skipped++; continue; }
        const image = sharp(original).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true });
        const metadata = await image.metadata();
        const optimized = await image.webp({ quality: 84 }).toBuffer();
        pathname = `drive/${file.id}-${version}.webp`;
        const blob = await put(pathname, optimized, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp" });
        blobUrl = blob.url;
        mimeType = "image/webp";
        width = metadata.width;
        height = metadata.height;
        bytes = optimized.length;
      }
      const values = { driveFileId: file.id, driveModifiedAt: new Date(file.modifiedTime || Date.now()), blobUrl, pathname, filename: file.name, mimeType, alt: `210 Robotics — ${file.album}`, caption: "", album: file.album, width, height, bytes, published: true, archivedAt: null, updatedAt: new Date() };
      await getDb().insert(mediaAssets).values(values).onConflictDoUpdate({ target: mediaAssets.driveFileId, set: values });
      imported++;
    } catch {
      skipped++;
    }
  }
  if (seen.length) await getDb().update(mediaAssets).set({ archivedAt: new Date(), published: false, updatedAt: new Date() }).where(and(isNotNull(mediaAssets.driveFileId), notInArray(mediaAssets.driveFileId, seen)));
  return { discovered: files.length, imported, skipped };
}
