"use client";

import { upload } from "@vercel/blob/client";
import Image from "next/image";
import { useId, useState } from "react";
import { finalizeMediaUpload } from "@/app/upload-actions";

type Purpose =
  | "self-profile"
  | "account-profile"
  | "roster-card"
  | "post-cover"
  | "sponsor-logo"
  | "site-content"
  | "doc-image"
  | "form-image";

export function ImageUpload({
  name,
  removeName,
  purpose,
  uploaderId,
  currentUrl,
  label = "Choose image",
  presentation = "portrait",
}: {
  name: string;
  removeName: string;
  purpose: Purpose;
  uploaderId: string;
  currentUrl?: string | null;
  label?: string;
  presentation?: "portrait" | "logo" | "landscape";
}) {
  const id = useId();
  const [mediaId, setMediaId] = useState("");
  const [preview, setPreview] = useState(currentUrl ?? "");
  const [removed, setRemoved] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function selectFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setStatus("Choose an image smaller than 5 MB.");
      return;
    }
    setBusy(true);
    setStatus("Uploading image…");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
      const pathname = `uploads/${purpose}/${uploaderId}/${crypto.randomUUID()}-${safeName}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: "/api/uploads",
        clientPayload: JSON.stringify({ purpose }),
      });
      const finalized = await finalizeMediaUpload({
        purpose,
        url: blob.url,
        pathname: blob.pathname,
        filename: file.name,
        contentType: file.type || "image/jpeg",
        size: file.size,
      });
      setMediaId(finalized.id);
      setPreview(finalized.url);
      setRemoved(false);
      setStatus("Image ready. Save the form to apply it.");
    } catch (error) {
      console.error(error);
      setStatus("Image upload failed. Check the file type and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-3">
      {preview && !removed && (
        <div
          className={
            presentation === "logo"
              ? "relative h-32 w-full max-w-xs overflow-hidden border border-[#3a3a3a] bg-[#151515] p-4"
              : presentation === "landscape"
                ? "relative aspect-[16/9] w-full max-w-xl overflow-hidden border border-[#3a3a3a] bg-[#151515]"
                : "relative h-40 w-32 overflow-hidden border border-[#3a3a3a] bg-[#151515]"
          }
        >
          <Image
            src={preview}
            alt="Selected image preview"
            fill
            sizes={
              presentation === "logo"
                ? "320px"
                : presentation === "landscape"
                  ? "(max-width: 640px) 100vw, 576px"
                  : "128px"
            }
            className={presentation === "logo" ? "object-contain p-4" : "object-cover"}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <label className="button secondary cursor-pointer" htmlFor={id}>
          {busy ? "Uploading…" : label}
        </label>
        {(preview || currentUrl) && !removed && (
          <button type="button" className="text-sm text-red-400" onClick={() => { setRemoved(true); setMediaId(""); setPreview(""); setStatus("Image will be removed when you save."); }}>
            Remove image
          </button>
        )}
      </div>
      <input
        id={id}
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
        disabled={busy}
        onChange={(event) => void selectFile(event.target.files?.[0])}
      />
      <input type="hidden" name={name} value={mediaId} />
      <input type="hidden" name={removeName} value={removed ? "on" : ""} />
      <p className="text-xs text-[#888]" aria-live="polite">{status || "JPEG, PNG, WebP, AVIF, HEIC, or HEIF · 5 MB maximum"}</p>
    </div>
  );
}
