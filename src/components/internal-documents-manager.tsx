"use client";

import { upload } from "@vercel/blob/client";
import {
  Archive,
  CloudDownload,
  Download,
  ExternalLink,
  FileText,
  FolderSync,
  LoaderCircle,
  Search,
  UploadCloud,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useMemo,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  archiveInternalDocument,
  finalizeInternalDocumentUpload,
  saveInternalDocument,
  syncInternalDocumentsFromDrive,
  type InternalDocumentActionState,
} from "@/app/admin/internal-document-actions";
import { NotebookEditor } from "@/components/notebook-editor";

type DocumentRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  originalFilename: string;
  mimeType: string;
  bytes: number;
  contentHtml: string;
  editable: boolean;
  driveWebViewLink: string | null;
  driveSyncStatus: string;
  currentVersion: number;
  updatedAt: string;
  updatedBy: string;
};

type RevisionRow = {
  id: string;
  documentId: string;
  versionNumber: number;
  reason: string;
  createdAt: string;
  editorName: string;
};

const idle: InternalDocumentActionState = { status: "idle", message: "" };

export function InternalDocumentsManager({
  documents,
  revisions,
  uploaderId,
}: {
  documents: DocumentRow[];
  revisions: RevisionRow[];
  uploaderId: string;
}) {
  const router = useRouter();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(documents[0]?.id ?? "");
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<InternalDocumentActionState>(idle);
  const [saving, startSaving] = useTransition();
  const [syncState, syncAction, syncing] = useActionState(
    syncInternalDocumentsFromDrive,
    idle,
  );
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return documents;
    return documents.filter((document) =>
      [document.title, document.category, document.originalFilename]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [documents, query]);
  const selected =
    documents.find((document) => document.id === selectedId) ?? documents[0];
  const selectedRevisions = selected
    ? revisions.filter((revision) => revision.documentId === selected.id)
    : [];

  async function importFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setNotice({ status: "idle", message: `Importing ${file.name}...` });
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/internal-document/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "private",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "internal-document" }),
      });
      const result = await finalizeInternalDocumentUpload({
        pathname: blob.pathname,
        filename: file.name,
        contentType: file.type || mimeFromName(file.name),
        size: file.size,
        category: "General",
        purpose: "internal-document",
      });
      setNotice(result);
      if (result.status === "success") {
        if (result.documentId) setSelectedId(result.documentId);
        router.refresh();
      }
    } catch (error) {
      console.error("Document upload failed", error);
      setNotice({
        status: "error",
        message: "The document could not be uploaded. Use a DOCX, PDF, XLSX, or CSV smaller than 40 MB.",
      });
    } finally {
      setUploading(false);
      if (uploadInput.current) uploadInput.current.value = "";
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startSaving(async () => {
      const result = await saveInternalDocument({
        documentId: String(form.get("documentId") || ""),
        title: String(form.get("title") || ""),
        description: String(form.get("description") || ""),
        category: String(form.get("category") || "General"),
        contentHtml: String(form.get("contentHtml") || ""),
        reason: String(form.get("reason") || ""),
      });
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  function archive(documentId: string) {
    if (!window.confirm("Archive this document? Its history will remain in the database."))
      return;
    startSaving(async () => {
      const form = new FormData();
      form.set("documentId", documentId);
      await archiveInternalDocument(form);
      setNotice({ status: "success", message: "Document archived." });
      setSelectedId(documents.find((document) => document.id !== documentId)?.id ?? "");
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#303030] pb-6">
        <div className="max-w-3xl">
          <h3 className="text-xl font-bold">Private document archive</h3>
          <p className="mt-2 text-sm leading-6 text-[#888]">
            DOCX files become editable, versioned pages. PDFs and spreadsheets stay
            view-only with their original layout. The site keeps a secure copy and syncs with the team Drive
            folder whenever runtime Drive access is available.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="button"
            type="button"
            disabled={uploading}
            onClick={() => uploadInput.current?.click()}
          >
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <UploadCloud className="size-4" />}
            {uploading ? "Importing" : "Upload document"}
          </button>
          <form action={syncAction}>
            <button className="button secondary" disabled={syncing}>
              {syncing ? <LoaderCircle className="size-4 animate-spin" /> : <FolderSync className="size-4" />}
              Sync Drive
            </button>
          </form>
          <input
            ref={uploadInput}
            className="sr-only"
            type="file"
            accept=".docx,.pdf,.xlsx,.csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={(event) => void importFile(event.target.files?.[0])}
          />
        </div>
      </div>

      {(notice.message || syncState.message) && (
        <p
          className={`border px-4 py-3 text-sm ${
            notice.status === "error" || syncState.status === "error"
              ? "border-red-500/40 bg-red-950/30 text-red-200"
              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          }`}
          aria-live="polite"
        >
          {notice.message || syncState.message}
        </p>
      )}

      <div className="internal-documents-layout grid min-h-[720px] gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="border border-[#303030] bg-[#0b0b0b] p-3">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#666]" />
            <input
              className="input w-full pl-10"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search documents"
              aria-label="Search documents"
            />
          </label>
          <p className="px-1 pb-2 pt-4 font-mono text-[.65rem] uppercase tracking-[.16em] text-[#666]">
            {visible.length} {visible.length === 1 ? "document" : "documents"}
          </p>
          <div className="grid max-h-[650px] gap-2 overflow-y-auto pr-1">
            {visible.map((document) => (
              <button
                className={`w-full border p-3 text-left transition ${
                  selected?.id === document.id
                    ? "border-[#fd7803] bg-[#fd7803]/10"
                    : "border-[#2d2d2d] bg-[#111] hover:border-[#555]"
                }`}
                type="button"
                key={document.id}
                onClick={() => setSelectedId(document.id)}
              >
                <div className="flex items-start gap-3">
                  <FileText className="mt-0.5 size-4 shrink-0 text-[#fd7803]" />
                  <span className="min-w-0">
                    <strong className="block truncate text-sm text-white">{document.title}</strong>
                    <span className="mt-1 block truncate text-[.68rem] text-[#777]">
                      {document.category} · v{document.currentVersion}
                    </span>
                  </span>
                </div>
              </button>
            ))}
            {!visible.length && (
              <p className="border border-dashed border-[#333] p-5 text-center text-sm text-[#777]">
                No matching documents.
              </p>
            )}
          </div>
        </aside>

        <main className="min-w-0">
          {selected ? (
            <div className="grid gap-5">
              <header className="flex flex-wrap items-start justify-between gap-4 border border-[#303030] bg-[#101010] p-5">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <span className="tag">{selected.editable ? "Editable DOCX" : `View-only ${selected.originalFilename.split(".").pop()?.toUpperCase() || "file"}`}</span>
                    <span className="tag">{driveStatus(selected.driveSyncStatus)}</span>
                  </div>
                  <h3 className="mt-3 text-2xl font-bold">{selected.title}</h3>
                  <p className="mt-2 text-xs text-[#777]">
                    {selected.originalFilename} · {formatBytes(selected.bytes)} · version {selected.currentVersion} · updated {new Date(selected.updatedAt).toLocaleString()} by {selected.updatedBy}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="button secondary" href={`/api/internal-documents/${selected.id}/file`} target="_blank">
                    <ExternalLink className="size-4" /> View original
                  </a>
                  <a className="button secondary" href={`/api/internal-documents/${selected.id}/file?download=1`}>
                    <Download className="size-4" /> Download
                  </a>
                  {selected.driveWebViewLink && (
                    <a className="button secondary" href={selected.driveWebViewLink} target="_blank" rel="noreferrer">
                      <CloudDownload className="size-4" /> Drive
                    </a>
                  )}
                </div>
              </header>

              {selected.editable ? (
                <form className="grid gap-5" onSubmit={save}>
                  <input type="hidden" name="documentId" value={selected.id} />
                  <section className="grid gap-4 border border-[#303030] bg-[#0d0d0d] p-5 md:grid-cols-2">
                    <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
                      Document title
                      <input className="input" name="title" defaultValue={selected.title} required />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
                      Category
                      <input className="input" name="category" defaultValue={selected.category} required />
                    </label>
                    <label className="grid gap-2 text-xs font-semibold text-[#aaa] md:col-span-2">
                      Description
                      <textarea className="input min-h-20" name="description" defaultValue={selected.description} />
                    </label>
                  </section>
                  <NotebookEditor
                    key={`${selected.id}-${selected.currentVersion}`}
                    initial={selected.contentHtml}
                    name="contentHtml"
                  />
                  <div className="flex flex-wrap items-end justify-between gap-4 border border-[#303030] bg-[#101010] p-4">
                    <label className="grid min-w-[260px] flex-1 gap-2 text-xs font-semibold text-[#aaa]">
                      Version note
                      <input className="input" name="reason" placeholder="What changed in this version?" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button className="button" disabled={saving}>Save version {selected.currentVersion + 1}</button>
                      <button className="button secondary" type="button" disabled={saving} onClick={() => archive(selected.id)}>
                        <Archive className="size-4" /> Archive
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <div className="grid gap-5">
                  <iframe
                    className="h-[780px] w-full border border-[#303030] bg-white"
                    src={`/api/internal-documents/${selected.id}/file`}
                    title={`PDF viewer: ${selected.title}`}
                  />
                  <details className="border border-[#303030] bg-[#101010] p-5">
                    <summary className="cursor-pointer font-semibold">Extracted searchable text</summary>
                    <div className="prose-editor mt-5" dangerouslySetInnerHTML={{ __html: selected.contentHtml }} />
                  </details>
                  <button className="button secondary w-fit" type="button" disabled={saving} onClick={() => archive(selected.id)}>
                    <Archive className="size-4" /> Archive PDF
                  </button>
                </div>
              )}

              {!!selectedRevisions.length && (
                <details className="border border-[#303030] bg-[#101010] p-5">
                  <summary className="cursor-pointer font-semibold">Version history ({selectedRevisions.length})</summary>
                  <div className="mt-4 grid gap-2">
                    {selectedRevisions.map((revision) => (
                      <div className="flex flex-wrap justify-between gap-3 border border-[#292929] p-3 text-sm" key={revision.id}>
                        <span><strong>Version {revision.versionNumber}</strong> · {revision.reason}</span>
                        <span className="text-xs text-[#777]">{new Date(revision.createdAt).toLocaleString()} · {revision.editorName}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          ) : (
            <div className="grid min-h-[500px] place-items-center border border-dashed border-[#3a3a3a] p-8 text-center">
              <div>
                <FileText className="mx-auto size-10 text-[#fd7803]" />
                <h3 className="mt-4 text-xl font-bold">Start the document archive</h3>
                <p className="mt-2 text-sm text-[#777]">Upload a DOCX, PDF, XLSX, or CSV, or sync the team Drive folder.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function mimeFromName(filename: string) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function driveStatus(status: string) {
  if (status === "SYNCED") return "Drive synced";
  if (status === "DRIVE_UPDATE_PENDING") return "Drive update pending";
  if (status === "DRIVE_UNAVAILABLE") return "Secure local archive";
  return "Secure local archive";
}
