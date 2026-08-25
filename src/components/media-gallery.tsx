"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { MediaCarousel } from "@/components/media-carousel";
import type { PublicMedia } from "@/lib/content";

export function MediaGallery({
  items,
  limit,
  groupByEvent = false,
  layout = "grid",
  initialEventKey = null,
  showSharedFolderLink = true,
}: {
  items: PublicMedia[];
  limit?: number;
  groupByEvent?: boolean;
  layout?: "grid" | "carousel";
  initialEventKey?: string | null;
  showSharedFolderLink?: boolean;
}) {
  const [active, setActive] = useState<PublicMedia | null>(null);
  const [activeEventKey, setActiveEventKey] = useState<string | null>(initialEventKey);
  const visible = useMemo(() => (limit ? items.slice(0, limit) : items), [items, limit]);
  const groups = useMemo(
    () =>
      groupByEvent
        ? [
            ...visible
              .reduce((map, item) => {
                const key = item.eventId || item.eventTitle || item.album;
                const current = map.get(key) || [];
                current.push(item);
                map.set(key, current);
                return map;
              }, new Map<string, PublicMedia[]>())
              .entries(),
          ].sort(([, left], [, right]) => {
            const leftDate = left[0]?.eventDate?.getTime() ?? 0;
            const rightDate = right[0]?.eventDate?.getTime() ?? 0;
            return rightDate - leftDate || (left[0]?.eventTitle || "").localeCompare(right[0]?.eventTitle || "");
          })
        : [["all", visible] as [string, PublicMedia[]]],
    [groupByEvent, visible],
  );
  const selectedEventKey = groups.some(([key]) => key === activeEventKey)
    ? activeEventKey
    : groups[0]?.[0] ?? null;
  const selectedEvent = groups.find(([key]) => key === selectedEventKey);
  const sharedFolderLink = showSharedFolderLink ? (
    <p className="mt-4 text-right text-[.68rem] text-[#aaa]">
      <a
        className="transition hover:text-[#fd7803]"
        href="https://drive.google.com/drive/folders/1IHg3ihyrWAotDgLh1_krBtgnKM5L6wXD"
        target="_blank"
        rel="noreferrer"
      >
        View the shared media folder in Google Drive ↗
      </a>
    </p>
  ) : null;

  if (!visible.length) {
    return <p className="border border-[#333] bg-[#0d0d0d] p-8 text-sm text-[#999]">No published event photos yet.</p>;
  }

  if (groupByEvent && selectedEvent) {
    const selectedItem = selectedEvent[1][0];
    const selectedIndex = groups.findIndex(([key]) => key === selectedEvent[0]);
    return (
      <>
        <div className="mb-6 border-y border-[#333] bg-[#0b0b0b] p-3 sm:p-4">
          <p className="mb-3 px-1 font-mono text-[.65rem] uppercase tracking-[.2em] text-[#777]">
            Event albums · choose one to expand
          </p>
          <div className="flex snap-x gap-3 overflow-x-auto pb-1" role="tablist" aria-label="Event galleries">
            {groups.map(([key, group], index) => {
              const item = group[0];
              const selected = key === selectedEventKey;
              return (
                <button
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-expanded={selected}
                  aria-controls="event-gallery-panel"
                  id={`event-gallery-tab-${index}`}
                  className={`min-w-[210px] snap-start border p-4 text-left transition sm:min-w-[250px] ${
                    selected
                      ? "border-[#fd7803] bg-[#fd7803] text-black"
                      : "border-[#333] bg-[#111] text-white hover:border-[#777]"
                  }`}
                  key={key}
                  onClick={() => setActiveEventKey(key)}
                >
                  <span className="block text-base font-bold leading-5">{item?.eventTitle || item?.album}</span>
                  <span className={`mt-3 block font-mono text-[.62rem] uppercase tracking-wider ${selected ? "text-black/70" : "text-[#888]"}`}>
                    {group.length} {group.length === 1 ? "photo" : "photos"}
                    {item?.eventDate ? ` · ${item.eventDate.toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <section
          className="scroll-mt-28"
          role="tabpanel"
          data-gallery-event={selectedEvent[0]}
          id="event-gallery-panel"
          aria-labelledby={`event-gallery-tab-${selectedIndex}`}
        >
          <header className="mb-5 flex flex-wrap items-end justify-between gap-4 border-b border-[#333] pb-5">
            <div>
              <p className="eyebrow">Selected event</p>
              <h3 className="mt-2 text-2xl font-bold sm:text-3xl">{selectedItem?.eventTitle || selectedItem?.album}</h3>
              {selectedItem?.eventDescription && (
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#999]">{selectedItem.eventDescription}</p>
              )}
            </div>
            <div className="flex items-center gap-4">
              {selectedItem?.eventDate && (
                <time className="font-mono text-xs uppercase tracking-wider text-[#fd7803]">
                  {selectedItem.eventDate.toLocaleDateString()}
                </time>
              )}
              {selectedItem?.eventDriveFolderId && (
                <a
                  className="font-mono text-[.65rem] uppercase tracking-wider text-[#999] transition hover:text-[#fd7803]"
                  href={`https://drive.google.com/drive/folders/${selectedItem.eventDriveFolderId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Event folder ↗
                </a>
              )}
            </div>
          </header>
          <MediaCarousel key={selectedEvent[0]} items={selectedEvent[1]} label={`${selectedItem?.eventTitle || "Event"} photos`} />
        </section>
        {sharedFolderLink}
      </>
    );
  }

  if (layout === "carousel") {
    return (
      <>
        <MediaCarousel items={visible} label={`${visible[0]?.eventTitle || "Event"} photos`} />
        {sharedFolderLink}
      </>
    );
  }

  return (
    <>
      <div>
        {groups.map(([key, group]) => (
          <section key={key}>
            <div className="media-grid">
              {group.map((item, index) =>
                item.mediaType === "video" ? (
                  <div className={`media-tile media-tile-${index % 6}`} key={item.id}>
                    <video
                      className="h-full w-full object-cover"
                      controls
                      playsInline
                      preload="metadata"
                      aria-label={item.alt}
                    >
                      <source src={item.url} type="video/mp4" />
                    </video>
                  </div>
                ) : (
                  <button
                    aria-label={`Open ${item.alt}`}
                    className={`group media-tile media-tile-${index % 6}`}
                    key={item.id}
                    onClick={() => setActive(item)}
                  >
                    <Image
                      src={item.url}
                      alt={item.alt}
                      fill
                      sizes="(max-width: 700px) 100vw, 40vw"
                      className="object-cover transition duration-700 group-hover:scale-110"
                    />
                  </button>
                ),
              )}
            </div>
          </section>
        ))}
      </div>
      {sharedFolderLink}
      {active && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onClick={() => setActive(null)}
        >
          <button className="lightbox-close" aria-label="Close image" onClick={() => setActive(null)}>
            <X aria-hidden="true" />
          </button>
          <div className="relative h-[82vh] w-[94vw] max-w-7xl" onClick={(event) => event.stopPropagation()}>
            {active.mediaType === "video" ? (
              <video className="h-full w-full object-contain" controls autoPlay playsInline>
                <source src={active.url} type="video/mp4" />
              </video>
            ) : (
              <Image src={active.url} alt={active.alt} fill sizes="94vw" className="object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
