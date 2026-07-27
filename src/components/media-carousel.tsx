"use client";

import Image from "next/image";
import { ChevronLeft, ChevronRight, Maximize2, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { PublicMedia } from "@/lib/content";

export function MediaCarousel({
  items,
  label = "Photo gallery",
}: {
  items: PublicMedia[];
  label?: string;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const current = items[currentIndex] ?? items[0];

  useEffect(() => {
    if (!lightboxOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [lightboxOpen]);

  if (!current) return null;

  const showPrevious = () =>
    setCurrentIndex((index) => (index - 1 + items.length) % items.length);
  const showNext = () =>
    setCurrentIndex((index) => (index + 1) % items.length);

  return (
    <>
      <section
        aria-label={label}
        aria-roledescription="carousel"
        className="overflow-hidden border border-[#333] bg-[#0d0d0d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#fd7803]"
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") showPrevious();
          if (event.key === "ArrowRight") showNext();
        }}
        tabIndex={0}
      >
        <div className="relative h-[clamp(280px,58vw,680px)] overflow-hidden bg-black">
          {current.mediaType === "video" ? (
            <video
              key={current.id}
              className="h-full w-full object-contain"
              controls
              playsInline
              preload="metadata"
              aria-label={current.alt}
            >
              <source src={current.url} type="video/mp4" />
            </video>
          ) : (
            <button
              type="button"
              className="group absolute inset-0"
              onClick={() => setLightboxOpen(true)}
              aria-label={`Open ${current.alt} full screen`}
            >
              <Image
                src={current.url}
                alt={current.alt}
                fill
                priority={currentIndex === 0}
                sizes="(max-width: 700px) 100vw, 1180px"
                className="object-contain transition duration-500 group-hover:scale-[1.015]"
              />
            </button>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/90 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-4 sm:p-6">
            <div>
              <p className="max-w-2xl text-sm font-medium text-white sm:text-base">
                {current.caption || current.alt}
              </p>
              <p className="mt-1 font-mono text-[.65rem] uppercase tracking-wider text-[#bbb]" aria-live="polite">
                Photo {currentIndex + 1} of {items.length}
              </p>
            </div>
          </div>

          {items.length > 1 && (
            <div className="absolute right-3 top-3 z-20 flex gap-2 sm:right-5 sm:top-5">
              <button type="button" className="gallery-control" onClick={showPrevious} aria-label="Previous photo">
                <ChevronLeft aria-hidden="true" />
              </button>
              <button type="button" className="gallery-control" onClick={showNext} aria-label="Next photo">
                <ChevronRight aria-hidden="true" />
              </button>
            </div>
          )}
          <button
            type="button"
            className="gallery-control absolute bottom-4 right-4 z-20 sm:bottom-6 sm:right-6"
            onClick={() => setLightboxOpen(true)}
            aria-label="Open current media full screen"
          >
            <Maximize2 aria-hidden="true" />
          </button>
        </div>

        {items.length > 1 && (
          <div className="flex snap-x gap-2 overflow-x-auto border-t border-[#333] p-3 sm:p-4" role="tablist" aria-label="Choose a photo">
            {items.map((item, index) => (
              <button
                type="button"
                role="tab"
                aria-selected={index === currentIndex}
                aria-label={`Show photo ${index + 1}: ${item.alt}`}
                className={`relative h-16 w-24 shrink-0 snap-start overflow-hidden border transition sm:h-20 sm:w-28 ${
                  index === currentIndex
                    ? "border-[#fd7803] ring-1 ring-[#fd7803]"
                    : "border-[#333] opacity-60 hover:border-[#777] hover:opacity-100"
                }`}
                key={item.id}
                onClick={() => setCurrentIndex(index)}
              >
                {item.mediaType === "video" ? (
                  <video className="h-full w-full object-cover" muted playsInline preload="metadata">
                    <source src={item.url} type="video/mp4" />
                  </video>
                ) : (
                  <Image src={item.url} alt="" fill sizes="112px" className="object-cover" />
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {lightboxOpen && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={current.alt}
          onClick={() => setLightboxOpen(false)}
        >
          <button className="lightbox-close" aria-label="Close media" onClick={() => setLightboxOpen(false)}>
            <X aria-hidden="true" />
          </button>
          {items.length > 1 && (
            <>
              <button
                className="gallery-control absolute left-4 top-1/2 z-[2] -translate-y-1/2 sm:left-8"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation();
                  showPrevious();
                }}
              >
                <ChevronLeft aria-hidden="true" />
              </button>
              <button
                className="gallery-control absolute right-4 top-1/2 z-[2] -translate-y-1/2 sm:right-8"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation();
                  showNext();
                }}
              >
                <ChevronRight aria-hidden="true" />
              </button>
            </>
          )}
          <div className="relative h-[82vh] w-[88vw] max-w-7xl" onClick={(event) => event.stopPropagation()}>
            {current.mediaType === "video" ? (
              <video key={current.id} className="h-full w-full object-contain" controls autoPlay playsInline>
                <source src={current.url} type="video/mp4" />
              </video>
            ) : (
              <Image src={current.url} alt={current.alt} fill sizes="88vw" className="object-contain" />
            )}
          </div>
        </div>
      )}
    </>
  );
}
