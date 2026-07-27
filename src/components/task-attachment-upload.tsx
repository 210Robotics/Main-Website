"use client";

import { upload } from "@vercel/blob/client";
import { useId, useState } from "react";
import {
  formatFileSize,
  MAX_FORM_FILE_BYTES,
  safeUploadFilename,
} from "@/lib/form-files";

export function TaskAttachmentUpload({ taskId }: { taskId: string }) {
  const id = useId();
  const [file, setFile] = useState<{
    url: string;
    pathname: string;
    name: string;
    type: string;
    size: number;
  } | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  async function select(selected?: File) {
    if (!selected) return;
    if (selected.size > MAX_FORM_FILE_BYTES) {
      setStatus("Choose a file smaller than 10 MB.");
      return;
    }
    setBusy(true);
    setStatus("Uploading attachment…");
    try {
      const response = await fetch("/api/task-upload-path", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          taskId,
          filename: safeUploadFilename(selected.name),
        }),
      });
      if (!response.ok) throw new Error("Could not prepare upload.");
      const { pathname: authorizedPath } = (await response.json()) as {
        pathname: string;
      };
      const blob = await upload(authorizedPath, selected, {
        access: "public",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose: "task-attachment", taskId }),
      });
      setFile({
        url: blob.url,
        pathname: blob.pathname,
        name: selected.name,
        type: selected.type || "application/octet-stream",
        size: selected.size,
      });
      setStatus(
        `${selected.name} (${formatFileSize(selected.size)}) is ready. Post the update to attach it.`,
      );
    } catch (error) {
      console.error(error);
      setStatus("Attachment upload failed. Check the file and try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="grid gap-3">
      <label className="button secondary w-fit cursor-pointer" htmlFor={id}>
        {busy ? "Uploading…" : file ? "Replace attachment" : "Attach file"}
      </label>
      <input
        className="sr-only"
        id={id}
        type="file"
        disabled={busy}
        accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.zip"
        onChange={(event) => void select(event.target.files?.[0])}
      />
      <input type="hidden" name="attachmentUrl" value={file?.url ?? ""} />
      <input
        type="hidden"
        name="attachmentPathname"
        value={file?.pathname ?? ""}
      />
      <input type="hidden" name="attachmentName" value={file?.name ?? ""} />
      <input type="hidden" name="attachmentMimeType" value={file?.type ?? ""} />
      <input type="hidden" name="attachmentBytes" value={file?.size ?? ""} />
      <p className="text-xs text-[#888]" aria-live="polite">
        {status ||
          "Images, PDF, Office files, CSV, text, or ZIP · 10 MB maximum"}
      </p>
    </div>
  );
}
