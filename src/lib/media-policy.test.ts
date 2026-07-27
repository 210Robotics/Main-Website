import { describe, expect, it } from "vitest";
import {
  DELETED_GALLERY_MEDIA_SOURCE,
  GALLERY_MEDIA_SOURCE,
  isGalleryMediaSource,
} from "@/lib/media-policy";

describe("gallery media classification", () => {
  it("publishes only shared Drive media in the gallery", () => {
    expect(isGalleryMediaSource(GALLERY_MEDIA_SOURCE)).toBe(true);
    expect(isGalleryMediaSource("self-profile")).toBe(false);
    expect(isGalleryMediaSource("roster-card")).toBe(false);
    expect(isGalleryMediaSource("post-cover")).toBe(false);
    expect(isGalleryMediaSource("sponsor-logo")).toBe(false);
    expect(isGalleryMediaSource("doc-image")).toBe(false);
  });

  it("keeps manually deleted Drive items out of the gallery", () => {
    expect(isGalleryMediaSource(DELETED_GALLERY_MEDIA_SOURCE)).toBe(false);
  });
});

