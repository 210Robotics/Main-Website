"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Link2, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  finalizeInternalDocumentUpload,
  importInternalDocumentFromDriveLink,
} from "@/app/admin/internal-document-actions";
import { importArchivedDocumentToNotebook } from "@/app/admin/operations/engineering-actions";

type Scope = { id: string; name: string; code?: string; isDefault?: boolean };

export function NotebookFileImport({
  uploaderId,
  seasons,
  projects,
  subsystems,
}: {
  uploaderId: string;
  seasons: Scope[];
  projects: Scope[];
  subsystems: Scope[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [driveUrl, setDriveUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(formData: FormData) {
    const normalizedDriveUrl = driveUrl.trim();
    if (!file && !normalizedDriveUrl) {
      input.current?.click();
      return;
    }
    setBusy(true);
    setError(false);
    setMessage(
      file
        ? `Importing ${file.name}...`
        : "Downloading and converting the Google Drive document...",
    );
    try {
      const archived = file
        ? await uploadNotebookSource(file, uploaderId)
        : await importInternalDocumentFromDriveLink({ url: normalizedDriveUrl });
      if (archived.status !== "success" || !archived.documentId)
        throw new Error(archived.message);
      formData.set("documentId", archived.documentId);
      const entry = await importArchivedDocumentToNotebook(formData);
      setMessage(
        normalizedDriveUrl
          ? "Google Drive document imported as an editable notebook page."
          : file?.name.toLowerCase().endsWith(".docx")
          ? "DOCX imported as a fully editable notebook page."
          : "PDF imported with editable extracted text and its original preserved in Documents.",
      );
      setFile(undefined);
      setDriveUrl("");
      if (input.current) input.current.value = "";
      router.push(`/admin/operations?tool=notebook&entry=${entry.id}`);
      router.refresh();
    } catch (cause) {
      console.error("Notebook document import failed", cause);
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "The notebook page could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form action={submit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-xs font-semibold text-[#aaa] xl:col-span-2">
          Page title
          <input className="input" name="title" placeholder="Uses the filename when blank" />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
          Entry type
          <select className="input" name="entryType" defaultValue="DESIGN">
            {['DESIGN', 'BUILD', 'TEST', 'RESEARCH', 'SOFTWARE', 'MEETING', 'COMPETITION', 'PLANNING'].map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
          Season
          <select className="input" name="seasonId" defaultValue={seasons.find((season) => season.isDefault)?.id ?? seasons[0]?.id ?? ""} required>
            {seasons.map((season) => <option value={season.id} key={season.id}>{season.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
          Project
          <select className="input" name="projectId" defaultValue="">
            <option value="">Season-wide</option>
            {projects.map((project) => <option value={project.id} key={project.id}>{project.code} · {project.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
          Subsystem
          <select className="input" name="subsystemId" defaultValue="">
            <option value="">All / unassigned</option>
            {subsystems.map((subsystem) => <option value={subsystem.id} key={subsystem.id}>{subsystem.code} · {subsystem.name}</option>)}
          </select>
        </label>
        <div className="md:col-span-2">
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => {
              setFile(event.target.files?.[0]);
              if (event.target.files?.[0]) setDriveUrl("");
              setMessage("");
            }}
          />
          <button className="button secondary min-h-12 w-full justify-center" type="button" onClick={() => input.current?.click()} disabled={busy}>
            <FileUp className="size-4" /> {file ? file.name : "Choose DOCX or PDF"}
          </button>
        </div>
        <label className="grid gap-2 text-xs font-semibold text-[#aaa] md:col-span-2">
          Or import from Google Drive
          <span className="relative block">
            <Link2 className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#777]" aria-hidden="true" />
            <input
              className="input w-full pl-10"
              type="url"
              inputMode="url"
              placeholder="https://docs.google.com/document/d/... or Drive DOCX/PDF link"
              value={driveUrl}
              onChange={(event) => {
                setDriveUrl(event.target.value);
                if (event.target.value) {
                  setFile(undefined);
                  if (input.current) input.current.value = "";
                }
                setMessage("");
              }}
            />
          </span>
          <span className="font-normal leading-5 text-[#777]">
            The file must be shared with the site service account or set to Anyone with the link can view.
          </span>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${error ? "text-red-300" : "text-emerald-300"}`} aria-live="polite">{message}</p>
        <button className="button" disabled={busy || (!file && !driveUrl.trim()) || !seasons.length}>
          {busy && <LoaderCircle className="size-4 animate-spin" />}
          {busy ? "Building notebook page" : "Import as notebook page"}
        </button>
      </div>
    </form>
  );
}

async function uploadNotebookSource(file: File, uploaderId: string) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
  const blob = await upload(
    `uploads/notebook-import/${uploaderId}/${crypto.randomUUID()}-${safeName}`,
    file,
    {
      access: "private",
      handleUploadUrl: "/api/uploads",
      clientPayload: JSON.stringify({ purpose: "notebook-import" }),
    },
  );
  return finalizeInternalDocumentUpload({
    pathname: blob.pathname,
    filename: file.name,
    contentType: file.type || mimeFromName(file.name),
    size: file.size,
    category: "Engineering notebook sources",
    purpose: "notebook-import",
  });
}

function mimeFromName(filename: string) {
  return filename.toLowerCase().endsWith(".pdf")
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
}
