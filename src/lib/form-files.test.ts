import { describe, expect, it } from "vitest";
import {
  isAllowedFormFileType,
  MAX_FORM_FILE_BYTES,
  normalizedFormFileType,
  safeUploadFilename,
} from "@/lib/form-files";

describe("public form file policy", () => {
  it("allows useful team documents but rejects executable web content", () => {
    expect(isAllowedFormFileType("application/pdf")).toBe(true);
    expect(isAllowedFormFileType("image/heic")).toBe(true);
    expect(isAllowedFormFileType("text/html")).toBe(false);
    expect(isAllowedFormFileType("application/javascript")).toBe(false);
  });

  it("uses a ten MiB limit and safe paths", () => {
    expect(MAX_FORM_FILE_BYTES).toBe(10_485_760);
    expect(safeUploadFilename("../../release form (final).pdf")).toBe(
      "..-..-release-form-final-.pdf",
    );
  });

  it("recovers useful types when a browser omits them", () => {
    expect(normalizedFormFileType({ name: "consent.pdf", type: "" })).toBe(
      "application/pdf",
    );
    expect(normalizedFormFileType({ name: "archive.exe", type: "" })).toBe("");
  });
});
