import "server-only";
import { GoogleAuth } from "google-auth-library";
import { put } from "@vercel/blob";
import sharp from "sharp";
import { and, eq, isNotNull, notInArray } from "drizzle-orm";
import { getDb } from "@/db";
import { mediaAssets } from "@/db/schema";

const folderMime = "application/vnd.google-apps.folder";
const allowed = new Set(["image/jpeg", "image/png", "image/webp"]);
const rootFolder = process.env.GOOGLE_DRIVE_PHOTO_FOLDER_ID || "1IHg3ihyrWAotDgLh1_krBtgnKM5L6wXD";

type DriveFile = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; parents?: string[] };

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
    else if (allowed.has(entry.mimeType)) result.push({ ...entry, album });
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
    if (Number(file.size || 0) > 5 * 1024 * 1024) { skipped++; continue; }
    const [existing] = await getDb().select().from(mediaAssets).where(eq(mediaAssets.driveFileId, file.id)).limit(1);
    if (existing?.driveModifiedAt?.toISOString() === new Date(file.modifiedTime || 0).toISOString() && !existing.archivedAt) { skipped++; continue; }
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) { skipped++; continue; }
    const original = Buffer.from(await response.arrayBuffer());
    if (original.length > 5 * 1024 * 1024) { skipped++; continue; }
    const image = sharp(original).rotate().resize({ width: 2200, height: 2200, fit: "inside", withoutEnlargement: true });
    const metadata = await image.metadata();
    const optimized = await image.webp({ quality: 84 }).toBuffer();
    const version = new Date(file.modifiedTime || Date.now()).getTime();
    const pathname = `drive/${file.id}-${version}.webp`;
    const blob = await put(pathname, optimized, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/webp" });
    const values = { driveFileId: file.id, driveModifiedAt: new Date(file.modifiedTime || Date.now()), blobUrl: blob.url, pathname, filename: file.name, mimeType: "image/webp", alt: `210 Robotics — ${file.album}`, caption: "", album: file.album, width: metadata.width, height: metadata.height, bytes: optimized.length, published: true, archivedAt: null, updatedAt: new Date() };
    await getDb().insert(mediaAssets).values(values).onConflictDoUpdate({ target: mediaAssets.driveFileId, set: values });
    imported++;
  }
  if (seen.length) await getDb().update(mediaAssets).set({ archivedAt: new Date(), published: false, updatedAt: new Date() }).where(and(isNotNull(mediaAssets.driveFileId), notInArray(mediaAssets.driveFileId, seen)));
  return { discovered: files.length, imported, skipped };
}
