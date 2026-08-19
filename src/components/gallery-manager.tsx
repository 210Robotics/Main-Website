"use client";

import { upload } from "@vercel/blob/client";
import {
  CalendarDays,
  FolderSync,
  LoaderCircle,
  Plus,
  Trash2,
  UploadCloud,
} from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  archiveGalleryEvent,
  attachGalleryMedia,
  deleteGalleryEvent,
  deleteGalleryMediaBatch,
  saveGalleryEvent,
  type AdminFormState,
} from "@/app/admin/actions";
import { finalizeMediaUpload } from "@/app/upload-actions";
import { CalendarInput } from "@/components/calendar-input";

type GalleryAsset = {
  id: string;
  blobUrl: string;
  filename: string;
  mimeType: string;
  alt: string;
  galleryEventId: string | null;
  album: string;
};

type GalleryEvent = {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  driveFolderId: string | null;
  published: boolean;
  legacyAlbum: string | null;
};

const initialState: AdminFormState = { status: "idle", message: "" };

export function GalleryManager({
  assets,
  events,
  uploaderId,
}: {
  assets: GalleryAsset[];
  events: GalleryEvent[];
  uploaderId: string;
}) {
  const router = useRouter();
  const photoInput = useRef<HTMLInputElement>(null);
  const [activeEventId, setActiveEventId] = useState(events[0]?.id ?? "all");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [message, setMessage] = useState<AdminFormState>(initialState);
  const [targetEventId, setTargetEventId] = useState(
    events.find((event) => !event.legacyAlbum)?.id ?? "",
  );
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const activeEvent = events.find((event) => event.id === activeEventId);
  const belongsToEvent = (asset: GalleryAsset, event: GalleryEvent) =>
    event.legacyAlbum
      ? !asset.galleryEventId && asset.album === event.legacyAlbum
      : asset.galleryEventId === event.id;
  const visibleAssets =
    activeEventId === "unassigned"
      ? assets.filter((asset) => !asset.galleryEventId)
      : activeEvent
        ? assets.filter((asset) => belongsToEvent(asset, activeEvent))
        : assets;
  const assetIds = useMemo(
    () => new Set(visibleAssets.map((asset) => asset.id)),
    [visibleAssets],
  );
  const selectedIds = [...selected].filter((id) => assetIds.has(id));
  const allSelected =
    visibleAssets.length > 0 && selectedIds.length === visibleAssets.length;

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveEvent(formData: FormData) {
    startTransition(async () => {
      const result = await saveGalleryEvent(initialState, formData);
      setMessage(result);
      if (result.status === "success") router.refresh();
    });
  }

  function archiveEvent(event: GalleryEvent) {
    if (
      !window.confirm(
        `Archive the “${event.title}” gallery event? Its photos will remain stored.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await archiveGalleryEvent(event.id);
        setMessage(result);
        setActiveEventId("all");
        router.refresh();
      } catch (error) {
        setMessage({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gallery event could not be archived.",
        });
      }
    });
  }

  function deleteEvent(event: GalleryEvent) {
    if (
      !window.confirm(
        `Delete “${event.title}” permanently? Its photos will be kept under Unsorted photos, and the gallery will be removed from linked news articles.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        const result = await deleteGalleryEvent(event.id);
        setMessage(result);
        setActiveEventId("unassigned");
        setSelected(new Set());
        router.refresh();
      } catch (error) {
        setMessage({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Gallery event could not be deleted.",
        });
      }
    });
  }

  function moveSelected() {
    if (!selectedIds.length || !targetEventId) {
      setMessage({
        status: "error",
        message: "Select photos and choose a destination gallery.",
      });
      return;
    }
    startTransition(async () => {
      try {
        const result = await attachGalleryMedia(targetEventId, selectedIds);
        setMessage(result);
        setSelected(new Set());
        setActiveEventId(targetEventId);
        router.refresh();
      } catch (error) {
        setMessage({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "Selected photos could not be moved.",
        });
      }
    });
  }

  async function addPhotos(files: FileList | null) {
    const event = events.find((candidate) => candidate.id === activeEventId);
    if (!event || event.legacyAlbum || !files?.length) {
      setMessage({
        status: "error",
        message: event?.legacyAlbum
          ? "Save this existing album as a gallery before uploading more photos."
          : "Choose an event before uploading gallery photos.",
      });
      return;
    }
    const chosen = [...files].slice(0, 30);
    setUploading(true);
    setMessage({
      status: "idle",
      message: `Uploading ${chosen.length} photo${chosen.length === 1 ? "" : "s"}…`,
    });
    try {
      const ids: string[] = [];
      for (const file of chosen) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
        const blob = await upload(
          `uploads/gallery-photo/${uploaderId}/${crypto.randomUUID()}-${safeName}`,
          file,
          {
            access: "public",
            handleUploadUrl: "/api/uploads",
            clientPayload: JSON.stringify({ purpose: "gallery-photo" }),
          },
        );
        const asset = await finalizeMediaUpload({
          purpose: "gallery-photo",
          url: blob.url,
          pathname: blob.pathname,
          filename: file.name,
          contentType: file.type || "image/jpeg",
          size: file.size,
        });
        ids.push(asset.id);
      }
      const result = await attachGalleryMedia(event.id, ids);
      setMessage(result);
      router.refresh();
    } catch (error) {
      setMessage({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Gallery photos could not be uploaded.",
      });
    } finally {
      setUploading(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  return (
    <div className="mt-6 grid gap-6">
      <section className="grid gap-4 border border-[#333] bg-[#0c0c0c] p-5">
        <div>
          <p className="eyebrow">Event galleries</p>
          <h3 className="mt-2 text-xl font-bold">
            Create a separate gallery for every event
          </h3>
          <p className="mt-2 text-sm leading-6 text-[#888]">
            Upload photos directly or paste a public Google Drive folder link.
            News posts can attach any event gallery.
          </p>
        </div>
        <form
          action={saveEvent}
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
            Event name
            <input
              className="input"
              name="title"
              placeholder="VEX U World Championship"
              required
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
            Event date
            <CalendarInput name="eventDate" type="date" />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#aaa] xl:col-span-2">
            Google Drive folder
            <input
              className="input"
              name="driveFolder"
              placeholder="https://drive.google.com/drive/folders/..."
            />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-[#aaa] md:col-span-2 xl:col-span-3">
            Description
            <input
              className="input"
              name="description"
              placeholder="Competition, outreach, build day, or team event"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-[#bbb]">
            <input defaultChecked name="published" type="checkbox" /> Publish
            event
          </label>
          <button className="button w-fit" disabled={pending}>
            <Plus className="size-4" /> Create event gallery
          </button>
        </form>
      </section>

      <div
        className="flex gap-2 overflow-x-auto border-y border-[#333] py-3"
        aria-label="Gallery events"
      >
        <button
          className={`min-w-fit border px-4 py-3 text-sm ${activeEventId === "all" ? "border-[#fd7803] text-white" : "border-[#333] text-[#888]"}`}
          type="button"
          onClick={() => {
            setActiveEventId("all");
            setSelected(new Set());
          }}
        >
          All photos
        </button>
        <button
          className={`min-w-fit border px-4 py-3 text-sm ${activeEventId === "unassigned" ? "border-[#fd7803] text-white" : "border-[#333] text-[#888]"}`}
          type="button"
          onClick={() => {
            setActiveEventId("unassigned");
            setSelected(new Set());
          }}
        >
          Unsorted photos
        </button>
        {events.map((event) => (
          <button
            className={`min-w-fit border px-4 py-3 text-left ${activeEventId === event.id ? "border-[#fd7803] bg-[#fd7803]/10" : "border-[#333]"}`}
            type="button"
            key={event.id}
            onClick={() => {
              setActiveEventId(event.id);
              setSelected(new Set());
            }}
          >
            <strong className="block text-sm">{event.title}</strong>
            <span className="mt-1 block text-[.65rem] text-[#777]">
              {assets.filter((asset) => belongsToEvent(asset, event)).length}{" "}
              photos{event.driveFolderId ? " · Drive linked" : ""}
            </span>
          </button>
        ))}
      </div>

      {events.find((event) => event.id === activeEventId) &&
        (() => {
          const event = events.find(
            (candidate) => candidate.id === activeEventId,
          )!;
          return (
            <details className="border border-[#333] bg-[#0d0d0d] p-5">
              <summary className="cursor-pointer font-semibold">
                Edit {event.title}
              </summary>
              <form
                action={saveEvent}
                className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
              >
                {event.legacyAlbum ? (
                  <input
                    name="legacyAlbum"
                    type="hidden"
                    value={event.legacyAlbum}
                  />
                ) : (
                  <input name="eventId" type="hidden" value={event.id} />
                )}
                <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
                  Event name
                  <input
                    className="input"
                    name="title"
                    defaultValue={event.title}
                    required
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold text-[#aaa]">
                  Event date
                  <CalendarInput
                    name="eventDate"
                    type="date"
                    defaultValue={event.eventDate?.slice(0, 10) ?? ""}
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold text-[#aaa] xl:col-span-2">
                  Google Drive folder
                  <input
                    className="input"
                    name="driveFolder"
                    defaultValue={event.driveFolderId ?? ""}
                  />
                </label>
                <label className="grid gap-2 text-xs font-semibold text-[#aaa] md:col-span-2 xl:col-span-3">
                  Description
                  <input
                    className="input"
                    name="description"
                    defaultValue={event.description}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-[#bbb]">
                  <input
                    defaultChecked={event.published}
                    name="published"
                    type="checkbox"
                  />{" "}
                  Published
                </label>
                <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-4">
                  <button className="button" disabled={pending}>
                    {event.legacyAlbum
                      ? "Convert and save gallery"
                      : "Save event"}
                  </button>
                  {!event.legacyAlbum && (
                    <>
                      <button
                        className="button secondary text-red-200"
                        disabled={pending}
                        type="button"
                        onClick={() => archiveEvent(event)}
                      >
                        Archive event
                      </button>
                      <button
                        className="button secondary !border-red-500/60 !text-red-200"
                        disabled={pending}
                        type="button"
                        onClick={() => deleteEvent(event)}
                      >
                        <Trash2 className="size-4" /> Delete gallery
                      </button>
                    </>
                  )}
                </div>
              </form>
            </details>
          );
        })()}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="button"
            type="button"
            disabled={
              uploading || !activeEvent || Boolean(activeEvent.legacyAlbum)
            }
            onClick={() => photoInput.current?.click()}
          >
            {uploading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <UploadCloud className="size-4" />
            )}
            {uploading ? "Uploading" : "Upload photos to event"}
          </button>
          <input
            ref={photoInput}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,.heic,.heif"
            multiple
            onChange={(event) => void addPhotos(event.target.files)}
          />
          {events.find((event) => event.id === activeEventId)
            ?.driveFolderId && (
            <span className="tag">
              <FolderSync className="size-3" /> Drive folder linked
            </span>
          )}
          {events.find((event) => event.id === activeEventId)?.eventDate && (
            <span className="tag">
              <CalendarDays className="size-3" />{" "}
              {new Date(
                events.find((event) => event.id === activeEventId)!.eventDate!,
              ).toLocaleDateString()}
            </span>
          )}
        </div>
        <p
          className={`text-sm ${message.status === "error" ? "text-red-300" : "text-emerald-300"}`}
          aria-live="polite"
        >
          {message.message}
        </p>
      </div>

      <form
        action={async (formData) => {
          const result = await deleteGalleryMediaBatch(initialState, formData);
          setMessage(result);
          if (result.status === "success") {
            setSelected(new Set());
            router.refresh();
          }
        }}
        onSubmit={(event) => {
          if (
            !selectedIds.length ||
            !window.confirm(
              `Delete ${selectedIds.length} selected gallery item${selectedIds.length === 1 ? "" : "s"}? The original Drive files will not be changed.`,
            )
          )
            event.preventDefault();
        }}
      >
        {selectedIds.map((id) => (
          <input key={id} type="hidden" name="mediaIds" value={id} />
        ))}
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#333] py-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className="button secondary !min-h-10"
              type="button"
              onClick={() =>
                setSelected(
                  allSelected
                    ? new Set()
                    : new Set(visibleAssets.map((asset) => asset.id)),
                )
              }
            >
              {allSelected ? "Clear all" : "Select all"}
            </button>
            <p className="text-sm text-[#999]">
              {selectedIds.length} of {visibleAssets.length} selected
            </p>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#aaa]">
              Move to
              <select
                className="input !min-h-10 !w-auto min-w-44"
                value={targetEventId}
                onChange={(event) => setTargetEventId(event.target.value)}
              >
                <option value="">Choose gallery</option>
                {events
                  .filter((event) => !event.legacyAlbum)
                  .map((event) => (
                    <option value={event.id} key={event.id}>
                      {event.title}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="button secondary !min-h-10"
              disabled={!selectedIds.length || !targetEventId || pending}
              type="button"
              onClick={moveSelected}
            >
              Move selected
            </button>
          </div>
          <button
            className="button !min-h-10 !border-red-400/60 !bg-red-950/40 !text-red-100 disabled:opacity-40"
            disabled={!selectedIds.length}
            type="submit"
          >
            Delete selected
            {selectedIds.length ? ` (${selectedIds.length})` : ""}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {visibleAssets.map((asset) => {
            const isSelected = selectedIds.includes(asset.id);
            return (
              <article
                className={`relative aspect-square overflow-hidden border-2 transition ${isSelected ? "border-[#fd7803]" : "border-[#333] hover:border-[#666]"}`}
                key={asset.id}
              >
                {asset.mimeType.startsWith("video/") ? (
                  <video
                    className="h-full w-full object-cover"
                    controls
                    preload="metadata"
                  >
                    <source src={asset.blobUrl} type={asset.mimeType} />
                  </video>
                ) : (
                  <Image
                    className="object-cover"
                    src={asset.blobUrl}
                    alt={asset.alt}
                    fill
                    sizes="160px"
                  />
                )}
                <label className="absolute left-2 top-2 z-10 flex min-h-10 cursor-pointer items-center gap-2 border border-white/25 bg-black/90 px-3 text-xs font-bold text-white">
                  <input
                    checked={isSelected}
                    className="h-4 w-4 accent-[#fd7803]"
                    onChange={() => toggle(asset.id)}
                    type="checkbox"
                  />{" "}
                  Select
                </label>
              </article>
            );
          })}
        </div>
        {!visibleAssets.length && (
          <p className="border border-dashed border-[#333] p-6 text-sm text-[#888]">
            No photos are assigned here yet.
          </p>
        )}
      </form>
    </div>
  );
}
