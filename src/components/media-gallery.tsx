"use client";

import Image from "next/image";
import { X } from "lucide-react";
import { useState } from "react";
import type { PublicMedia } from "@/lib/content";

export function MediaGallery({
  items,
  limit,
}: {
  items: PublicMedia[];
  limit?: number;
}) {
  const [active, setActive] = useState<PublicMedia | null>(null);
  const visible = limit ? items.slice(0, limit) : items;
  return (
    <>
      <div className="media-grid">
        {visible.map((item, index) => (
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
        ))}
      </div>
      <p className="mt-4 text-right text-[.68rem] text-[#666]">
        <a
          className="transition hover:text-[#fd7803]"
          href="https://drive.google.com/drive/folders/1IHg3ihyrWAotDgLh1_krBtgnKM5L6wXD"
          target="_blank"
          rel="noreferrer"
        >
          View the shared photo folder in Google Drive ↗
        </a>
      </p>
      {active && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={active.alt}
          onClick={() => setActive(null)}
        >
          <button
            className="lightbox-close"
            aria-label="Close image"
            onClick={() => setActive(null)}
          >
            <X />
          </button>
          <div
            className="relative h-[82vh] w-[94vw] max-w-7xl"
            onClick={(event) => event.stopPropagation()}
          >
            <Image
              src={active.url}
              alt={active.alt}
              fill
              sizes="94vw"
              className="object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}
