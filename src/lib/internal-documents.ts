import "server-only";

import { get, put } from "@vercel/blob";
import ExcelJS from "exceljs";
import mammoth from "mammoth";
import sanitizeHtml from "sanitize-html";
import type { InternalDocumentAsset } from "@/db/schema";
import {
  getDriveAccessToken,
  hasDriveCredentials,
} from "@/lib/drive-sync";
import { privateBlobToken } from "@/lib/private-blob";

export const INTERNAL_DOCUMENT_FOLDER_ID =
  process.env.GOOGLE_DRIVE_DOCUMENT_FOLDER_ID ||
  "14ivFgIfoH6feVjnMeH_gBtyzE4pmrDvu";
export const MAX_INTERNAL_DOCUMENT_BYTES = 40 * 1024 * 1024;
export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const PDF_MIME = "application/pdf";
export const XLSX_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_MIME = "text/csv";
export const allowedInternalDocumentTypes = [
  DOCX_MIME,
  PDF_MIME,
  XLSX_MIME,
  CSV_MIME,
] as const;

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
};

const GOOGLE_DOC_MIME = "application/vnd.google-apps.document";
const GOOGLE_SHEET_MIME = "application/vnd.google-apps.spreadsheet";

export function parseGoogleDriveDocumentLink(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("Paste a valid Google Drive or Google Docs link.");
  }
  const host = url.hostname.toLowerCase();
  if (!["drive.google.com", "docs.google.com"].includes(host))
    throw new Error("Only Google Drive and Google Docs links can be imported.");
  const pathMatch = url.pathname.match(
    /\/(?:file|document|spreadsheets)\/d\/([a-zA-Z0-9_-]{10,})/,
  );
  const queryId = url.searchParams.get("id")?.match(/^[a-zA-Z0-9_-]{10,}$/)?.[0];
  const id = pathMatch?.[1] || queryId;
  if (!id) throw new Error("The Google Drive file ID could not be found in that link.");
  return {
    id,
    nativeGoogleDoc: host === "docs.google.com" && url.pathname.includes("/document/d/"),
    nativeGoogleSheet:
      host === "docs.google.com" && url.pathname.includes("/spreadsheets/d/"),
    webViewLink: url.toString(),
  };
}

function decodeDriveHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

export function sanitizeInternalDocumentHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "sub",
      "sup",
      "mark",
      "h1",
      "h2",
      "h3",
      "h4",
      "ul",
      "ol",
      "li",
      "blockquote",
      "code",
      "pre",
      "a",
      "img",
      "hr",
      "div",
      "label",
      "input",
      "table",
      "thead",
      "tbody",
      "tr",
      "th",
      "td",
    ],
    allowedAttributes: {
      a: [
        "href",
        "target",
        "rel",
        "title",
        "class",
        "data-link-embed",
      ],
      img: ["src", "alt", "title", "width", "height"],
      hr: ["data-page-break", "class"],
      p: ["style"],
      h1: ["style"],
      h2: ["style"],
      h3: ["style"],
      ul: ["data-type"],
      li: ["data-type", "data-checked"],
      div: ["data-type"],
      input: ["type", "checked", "disabled"],
      th: ["colspan", "rowspan"],
      td: ["colspan", "rowspan"],
    },
    allowedClasses: {
      a: ["notebook-link-embed"],
      hr: ["notebook-page-break"],
    },
    allowedStyles: {
      "*": {
        "text-align": [/^(left|center|right|justify)$/],
      },
    },
    allowedSchemes: ["http", "https", "mailto"],
  });
}

export function safeDocumentName(value: string) {
  const cleaned = value
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return (cleaned || "210-Robotics-document").slice(0, 180);
}

export function isSupportedInternalDocument(
  mimeType: string,
  filename: string,
) {
  const lower = filename.toLowerCase();
  return (
    allowedInternalDocumentTypes.includes(
      mimeType as (typeof allowedInternalDocumentTypes)[number],
    ) ||
    lower.endsWith(".docx") ||
    lower.endsWith(".pdf") ||
    lower.endsWith(".xlsx") ||
    lower.endsWith(".csv")
  );
}

export async function readPrivateBlob(pathname: string) {
  const result = await get(pathname, {
    access: "private",
    useCache: false,
    token: privateBlobToken(),
  });
  if (!result || result.statusCode !== 200)
    throw new Error("The uploaded document could not be read.");
  const buffer = Buffer.from(await new Response(result.stream).arrayBuffer());
  if (buffer.byteLength > MAX_INTERNAL_DOCUMENT_BYTES)
    throw new Error("The document is larger than 40 MB.");
  return buffer;
}

function imageExtension(mimeType: string) {
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/svg+xml") return "svg";
  if (mimeType === "image/webp") return "webp";
  return "png";
}

export async function docxToEditableHtml(
  documentId: string,
  buffer: Buffer,
) {
  if (buffer.subarray(0, 2).toString("ascii") !== "PK")
    throw new Error("This file is not a valid DOCX document.");
  const embeddedAssets: InternalDocumentAsset[] = [];
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      includeDefaultStyleMap: true,
      ignoreEmptyParagraphs: false,
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => p.document-subtitle:fresh",
      ],
      convertImage: mammoth.images.imgElement(async (image) => {
        const bytes = await image.readAsBuffer();
        const index = embeddedAssets.length;
        const filename = `embedded-image-${index + 1}.${imageExtension(image.contentType)}`;
        const pathname = `internal-documents/${documentId}/assets/${filename}`;
        const blob = await put(pathname, bytes, {
          access: "private",
          token: privateBlobToken(),
          contentType: image.contentType,
          addRandomSuffix: true,
        });
        embeddedAssets.push({
          pathname: blob.pathname,
          filename,
          mimeType: image.contentType,
          bytes: bytes.byteLength,
        });
        return {
          src: `/api/internal-documents/${documentId}/assets/${index}`,
        };
      }),
    },
  );
  return {
    html: sanitizeInternalDocumentHtml(result.value),
    embeddedAssets,
    warnings: result.messages.map((message) => message.message),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function pdfToEditableHtml(buffer: Buffer) {
  if (buffer.subarray(0, 5).toString("ascii") !== "%PDF-")
    throw new Error("This file is not a valid PDF document.");
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const document = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    }).promise;
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .flatMap((item) => ("str" in item ? [item.str] : []))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pages.push(
        `<h2>Imported PDF page ${pageNumber}</h2><p>${escapeHtml(text || "This page contains visual content. View the original PDF for the complete page.")}</p>`,
      );
    }
    await document.cleanup();
    return sanitizeInternalDocumentHtml(
      pages.join('<hr data-page-break="true" class="notebook-page-break">'),
    );
  } catch (error) {
    console.error("PDF text extraction failed", error);
    return "<p>The PDF is stored in the archive. Use the original-file viewer for its complete layout.</p>";
  }
}

export async function spreadsheetToArchiveHtml(
  buffer: Buffer,
  mimeType: string,
) {
  const rows: string[][] = [];
  if (mimeType === XLSX_MIME) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const worksheet = workbook.worksheets[0];
    worksheet?.eachRow({ includeEmpty: false }, (row) => {
      if (rows.length >= 200) return;
      const values: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell, column) => {
        if (column <= 50) values[column - 1] = cell.text.trim();
      });
      rows.push(values);
    });
  } else {
    for (const line of buffer.toString("utf8").split(/\r?\n/).slice(0, 200)) {
      if (line.trim()) rows.push(line.split(/,|\t/).slice(0, 50));
    }
  }
  if (!rows.length)
    return "<p>The spreadsheet is stored in the archive but contains no readable rows.</p>";
  const [headers, ...body] = rows;
  const table = [
    "<table><thead><tr>",
    ...headers.map((value) => `<th>${escapeHtml(value || "Column")}</th>`),
    "</tr></thead><tbody>",
    ...body.flatMap((row) => [
      "<tr>",
      ...headers.map((_, index) => `<td>${escapeHtml(row[index] || "")}</td>`),
      "</tr>",
    ]),
    "</tbody></table>",
  ].join("");
  return sanitizeInternalDocumentHtml(table);
}

export async function listInternalDriveFiles() {
  if (!hasDriveCredentials()) {
    const response = await fetch(
      `https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(INTERNAL_DOCUMENT_FOLDER_ID)}#grid`,
      { cache: "no-store", signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok)
      throw new Error(`The shared Google Drive folder is unavailable (${response.status}).`);
    const html = await response.text();
    return html
      .split('<div class="flip-entry" id="entry-')
      .slice(1)
      .flatMap((chunk): DriveFile[] => {
        const id = chunk.match(/^([^"]+)/)?.[1];
        const encodedHref = chunk.match(/<a href="([^"]+)"/)?.[1] ?? "";
        const rawTitle = chunk.match(/<div class="flip-entry-title">([\s\S]*?)<\/div>/)?.[1];
        if (!id || !rawTitle) return [];
        const name = decodeDriveHtml(rawTitle).trim();
        const href = decodeDriveHtml(encodedHref);
        const lowerName = name.toLowerCase();
        const iconType = chunk.match(
          /drive-thirdparty\.googleusercontent\.com\/16\/type\/([^"?]+)/,
        )?.[1];
        const mimeType = href.includes("/document/d/")
          ? "application/vnd.google-apps.document"
          : lowerName.endsWith(".docx")
            ? DOCX_MIME
            : lowerName.endsWith(".pdf")
              ? PDF_MIME
              : decodeURIComponent(iconType ?? "application/octet-stream");
        return [{ id, name, mimeType, webViewLink: href || undefined }];
      });
  }
  const token = await getDriveAccessToken();
  const params = new URLSearchParams({
    q: `'${INTERNAL_DOCUMENT_FOLDER_ID}' in parents and trashed = false`,
    pageSize: "1000",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
  });
  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?${params}`,
    { headers: { authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!response.ok)
    throw new Error(`Google Drive folder listing failed (${response.status}).`);
  return ((await response.json()) as { files?: DriveFile[] }).files ?? [];
}

export async function downloadInternalDriveFile(file: DriveFile) {
  const googleDoc = file.mimeType === GOOGLE_DOC_MIME;
  const googleSheet = file.mimeType === GOOGLE_SHEET_MIME;
  const authenticated = hasDriveCredentials();
  const url = authenticated
    ? googleDoc
      ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`
      : googleSheet
        ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=${encodeURIComponent(XLSX_MIME)}`
      : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&supportsAllDrives=true`
    : googleDoc
      ? `https://docs.google.com/document/d/${encodeURIComponent(file.id)}/export?format=docx`
      : googleSheet
        ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(file.id)}/export?format=xlsx`
      : `https://drive.usercontent.google.com/download?id=${encodeURIComponent(file.id)}&export=download&confirm=t`;
  const response = await fetch(url, {
    headers: authenticated
      ? { authorization: `Bearer ${await getDriveAccessToken()}` }
      : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(`Google Drive download failed (${response.status}).`);
  const responseType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  const disposition = response.headers.get("content-disposition") || "";
  const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const quotedName = disposition.match(/filename="([^"]+)"/i)?.[1];
  let responseName = quotedName;
  if (encodedName) {
    try {
      responseName = decodeURIComponent(encodedName);
    } catch {
      responseName = encodedName;
    }
  }
  const resolvedMimeType = googleDoc
    ? DOCX_MIME
    : googleSheet
      ? XLSX_MIME
    : allowedInternalDocumentTypes.includes(responseType as (typeof allowedInternalDocumentTypes)[number])
      ? responseType
      : file.mimeType;
  let filename = googleDoc
    ? `${file.name.replace(/\.docx$/i, "")}.docx`
    : googleSheet
      ? `${file.name.replace(/\.xlsx$/i, "")}.xlsx`
    : responseName || file.name;
  if (resolvedMimeType === PDF_MIME && !filename.toLowerCase().endsWith(".pdf"))
    filename += ".pdf";
  if (resolvedMimeType === DOCX_MIME && !filename.toLowerCase().endsWith(".docx"))
    filename += ".docx";
  if (resolvedMimeType === XLSX_MIME && !filename.toLowerCase().endsWith(".xlsx"))
    filename += ".xlsx";
  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    filename: safeDocumentName(filename),
    mimeType: resolvedMimeType,
  };
}

export async function downloadSharedDriveDocument(value: string) {
  const parsed = parseGoogleDriveDocumentLink(value);
  let file: DriveFile = {
    id: parsed.id,
    name: parsed.nativeGoogleDoc
      ? "Google Drive document"
      : parsed.nativeGoogleSheet
        ? "Google Drive spreadsheet"
        : "Google Drive file",
    mimeType: parsed.nativeGoogleDoc
      ? GOOGLE_DOC_MIME
      : parsed.nativeGoogleSheet
        ? GOOGLE_SHEET_MIME
        : "application/octet-stream",
    webViewLink: parsed.webViewLink,
  };
  if (hasDriveCredentials()) {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(parsed.id)}?supportsAllDrives=true&fields=id,name,mimeType,size,modifiedTime,webViewLink`,
      {
        headers: { authorization: `Bearer ${await getDriveAccessToken()}` },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );
    if (!response.ok)
      throw new Error(`Google Drive could not access this document (${response.status}).`);
    file = (await response.json()) as DriveFile;
  }
  if (
    file.mimeType !== GOOGLE_DOC_MIME &&
    file.mimeType !== GOOGLE_SHEET_MIME &&
    file.mimeType !== "application/octet-stream" &&
    !isSupportedInternalDocument(file.mimeType, file.name)
  )
    throw new Error(
      "That Drive file is not a Google Doc, Google Sheet, DOCX, PDF, XLSX, or CSV file.",
    );
  const source = await downloadInternalDriveFile(file);
  return {
    ...source,
    driveFileId: file.id,
    driveWebViewLink: file.webViewLink || parsed.webViewLink,
    driveModifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : null,
  };
}

export async function saveInternalDocumentToDrive({
  buffer,
  filename,
  mimeType,
  driveFileId,
  folderId,
}: {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  driveFileId?: string | null;
  folderId?: string | null;
}) {
  if (!hasDriveCredentials()) return null;
  const token = await getDriveAccessToken([
    "https://www.googleapis.com/auth/drive.file",
  ]);
  const metadata: Record<string, unknown> = { name: safeDocumentName(filename) };
  if (!driveFileId)
    metadata.parents = [folderId || INTERNAL_DOCUMENT_FOLDER_ID];
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify(metadata)], { type: "application/json" }),
  );
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    safeDocumentName(filename),
  );
  const endpoint = driveFileId
    ? `https://www.googleapis.com/upload/drive/v3/files/${driveFileId}`
    : "https://www.googleapis.com/upload/drive/v3/files";
  const params = new URLSearchParams({
    uploadType: "multipart",
    supportsAllDrives: "true",
    fields: "id,webViewLink,modifiedTime",
  });
  const response = await fetch(`${endpoint}?${params}`, {
    method: driveFileId ? "PATCH" : "POST",
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  if (!response.ok)
    throw new Error(`Google Drive upload failed (${response.status}).`);
  return (await response.json()) as {
    id: string;
    webViewLink?: string;
    modifiedTime?: string;
  };
}
