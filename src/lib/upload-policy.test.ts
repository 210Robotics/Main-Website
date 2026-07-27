import { describe, expect, it } from "vitest";
import { MAX_IMAGE_BYTES, isAllowedImageType } from "@/lib/upload-policy";

describe("image upload policy", () => {
  it("accepts browser-safe and HEIC source images", () => {
    expect(isAllowedImageType("image/jpeg")).toBe(true);
    expect(isAllowedImageType("image/heic")).toBe(true);
  });

  it("rejects non-image and executable content", () => {
    expect(isAllowedImageType("image/svg+xml")).toBe(false);
    expect(isAllowedImageType("application/javascript")).toBe(false);
  });

  it("caps source files at five MiB", () => {
    expect(MAX_IMAGE_BYTES).toBe(5_242_880);
  });
});
