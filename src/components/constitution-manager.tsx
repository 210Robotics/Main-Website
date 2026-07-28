"use client";

import { upload } from "@vercel/blob/client";
import {
  Download,
  ExternalLink,
  FileCheck2,
  History,
  LoaderCircle,
  UploadCloud,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  publishConstitution,
  unpublishConstitution,
  type ConstitutionActionState,
} from "@/app/admin/constitution-actions";
import { finalizeInternalDocumentUpload } from "@/app/admin/internal-document-actions";

type ConstitutionDocument = {
  id: string;
  title: string;
  originalFilename: string;
  mimeType: string;
  bytes: number;
  currentVersion: number;
  updatedAt: string;
};

const idle: ConstitutionActionState = { status: "idle", message: "" };

export function ConstitutionManager({
  uploaderId,
  documents,
  publishedDocumentId,
  publishedVersion,
  effectiveDate,
  publishedAt,
}: {
  uploaderId: string;
  documents: ConstitutionDocument[];
  publishedDocumentId: string | null;
  publishedVersion: string | null;
  effectiveDate: string | null;
  publishedAt: string | null;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [version, setVersion] = useState(
    publishedVersion || `${new Date().getFullYear()} Edition`,
  );
  const [date, setDate] = useState(
    effectiveDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
  );
  const [notice, setNotice] = useState(idle);
  const [pending, startTransition] = useTransition();
  const current = documents.find(
    (document) => document.id === publishedDocumentId,
  );

  async function uploadLatest(file: File | undefined) {
    if (!file) return;
    if (!/\.(pdf|docx)$/i.test(file.name)) {
      setNotice({
        status: "error",
        message: "Upload the approved constitution as a PDF or DOCX file.",
      });
      return;
    }
    startTransition(async () => {
      setNotice({ status: "idle", message: `Uploading ${file.name}...` });
      try {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const pathname = `uploads/internal-document/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
        const blob = await upload(pathname, file, {
          access: "private",
          handleUploadUrl: "/api/uploads",
          clientPayload: JSON.stringify({ purpose: "internal-document" }),
        });
        const archived = await finalizeInternalDocumentUpload({
          pathname: blob.pathname,
          filename: file.name,
          contentType: file.type || mimeFromName(file.name),
          size: file.size,
          category: "Constitution",
          purpose: "internal-document",
        });
        if (archived.status !== "success" || !archived.documentId) {
          throw new Error(archived.message);
        }
        const form = new FormData();
        form.set("documentId", archived.documentId);
        form.set("version", version);
        form.set("effectiveDate", date);
        const result = await publishConstitution(form);
        setNotice(result);
        if (result.status === "success") router.refresh();
      } catch (error) {
        setNotice({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "The constitution could not be uploaded.",
        });
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  function publishExisting(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await publishConstitution(form);
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  function unpublish() {
    if (
      !window.confirm(
        "Remove the constitution from the public website? The archived document will remain available to administrators.",
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await unpublishConstitution();
      setNotice(result);
      if (result.status === "success") router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-5 border border-[#3a2b20] bg-[#100d0b] p-5 sm:p-6 xl:grid-cols-[1.2fr_.8fr]">
        <div>
          <p className="eyebrow">Current public version</p>
          {current ? (
            <>
              <h3 className="mt-3 text-2xl font-bold">
                {publishedVersion || current.title}
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#999]">
                {current.originalFilename}
                {effectiveDate
                  ? ` · effective ${new Date(effectiveDate).toLocaleDateString()}`
                  : ""}
                {publishedAt
                  ? ` · published ${new Date(publishedAt).toLocaleDateString()}`
                  : ""}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  className="button"
                  href="/constitution"
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink className="size-4" />
                  View public page
                </a>
                <Link
                  className="button secondary"
                  href="/api/constitution/file?download=1"
                >
                  <Download className="size-4" />
                  Download current
                </Link>
                <button
                  className="button secondary"
                  type="button"
                  disabled={pending}
                  onClick={unpublish}
                >
                  Unpublish
                </button>
              </div>
            </>
          ) : (
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#888]">
              No constitution is public yet. Upload the latest approved PDF or
              DOCX below; it will also be preserved in Internal Documents with
              version history.
            </p>
          )}
        </div>
        <div className="border border-[#332820] bg-black/30 p-4">
          <FileCheck2 className="size-7 text-[#fd7803]" />
          <h4 className="mt-4 font-bold">Safe public publishing</h4>
          <p className="mt-2 text-sm leading-6 text-[#888]">
            Only the selected constitution becomes public. Other internal
            documents and prior drafts remain private.
          </p>
        </div>
      </section>

      <section className="border border-[#303030] bg-[#0d0d0d] p-5 sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="eyebrow">Upload latest version</p>
            <h3 className="mt-3 text-xl font-bold">
              Publish a new constitution
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#888]">
              Uploading here archives the original file and immediately makes
              this version the constitution displayed on the website.
            </p>
          </div>
          <button
            className="button w-full justify-center lg:w-auto"
            type="button"
            disabled={pending || !version.trim() || !date}
            onClick={() => input.current?.click()}
          >
            {pending ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {pending ? "Publishing..." : "Upload and publish"}
          </button>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="field">
            <span>Version label</span>
            <input
              className="input"
              value={version}
              maxLength={100}
              onChange={(event) => setVersion(event.target.value)}
              placeholder="2026 Edition"
            />
          </label>
          <label className="field">
            <span>Effective date</span>
            <input
              className="input"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => void uploadLatest(event.target.files?.[0])}
          />
        </div>
      </section>

      {notice.message && (
        <p
          className={`border px-4 py-3 text-sm ${
            notice.status === "error"
              ? "border-red-500/40 bg-red-950/30 text-red-200"
              : "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          }`}
          aria-live="polite"
        >
          {notice.message}
        </p>
      )}

      {!!documents.length && (
        <section className="border border-[#303030] bg-[#0d0d0d] p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <History className="size-5 text-[#fd7803]" />
            <h3 className="text-lg font-bold">Archived constitution versions</h3>
          </div>
          <div className="mt-5 grid gap-3">
            {documents.map((document) => (
              <form
                className="grid gap-4 border border-[#292929] bg-black/25 p-4 md:grid-cols-[minmax(0,1fr)_10rem_11rem_auto] md:items-end"
                key={document.id}
                onSubmit={publishExisting}
              >
                <input type="hidden" name="documentId" value={document.id} />
                <div className="min-w-0">
                  <strong className="block truncate text-sm text-white">
                    {document.title}
                  </strong>
                  <span className="mt-1 block truncate text-xs text-[#777]">
                    {document.originalFilename} · {formatBytes(document.bytes)} ·
                    archived {new Date(document.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <label className="field">
                  <span>Version</span>
                  <input
                    className="input"
                    name="version"
                    defaultValue={
                      document.id === publishedDocumentId
                        ? publishedVersion || ""
                        : `Version ${document.currentVersion}`
                    }
                    required
                  />
                </label>
                <label className="field">
                  <span>Effective</span>
                  <input
                    className="input"
                    type="date"
                    name="effectiveDate"
                    defaultValue={
                      document.id === publishedDocumentId
                        ? effectiveDate?.slice(0, 10) || date
                        : date
                    }
                    required
                  />
                </label>
                <button
                  className="button secondary w-full justify-center"
                  disabled={pending || document.id === publishedDocumentId}
                >
                  {document.id === publishedDocumentId
                    ? "Currently public"
                    : "Publish this version"}
                </button>
              </form>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function mimeFromName(filename: string) {
  return filename.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
