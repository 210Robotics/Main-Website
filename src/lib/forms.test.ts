import { describe, expect, it, vi } from "vitest";
import { publicFormFieldsSchema, sanitizeFormHtml } from "@/lib/forms";

vi.mock("server-only", () => ({}));

const firstId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";

describe("public form definitions", () => {
  it("accepts supported question definitions", () => {
    const result = publicFormFieldsSchema.safeParse([
      {
        id: firstId,
        type: "MULTIPLE_CHOICE",
        label: "Choose a workshop",
        description: "Pick one.",
        required: true,
        options: ["CAD", "Programming"],
      },
      {
        id: secondId,
        type: "LONG_TEXT",
        label: "What do you want to learn?",
        description: "",
        required: false,
        options: [],
      },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects duplicate field ids and incomplete choice lists", () => {
    const result = publicFormFieldsSchema.safeParse([
      {
        id: firstId,
        type: "MULTIPLE_CHOICE",
        label: "First",
        description: "",
        required: false,
        options: ["Only one"],
      },
      {
        id: firstId,
        type: "SHORT_TEXT",
        label: "Second",
        description: "",
        required: false,
        options: [],
      },
    ]);
    expect(result.success).toBe(false);
  });

  it("accepts file tiles with a bounded upload count", () => {
    expect(publicFormFieldsSchema.safeParse([{
      id: firstId,
      type: "FILE_UPLOAD",
      label: "Upload your release form",
      description: "PDF or image",
      required: true,
      options: [],
      maxFiles: 2,
    }]).success).toBe(true);
    expect(publicFormFieldsSchema.safeParse([{
      id: firstId,
      type: "FILE_UPLOAD",
      label: "Upload files",
      description: "",
      required: false,
      options: [],
      maxFiles: 6,
    }]).success).toBe(false);
  });

  it("keeps safe links and images while removing executable markup", () => {
    const clean = sanitizeFormHtml(
      '<h2>Welcome</h2><script>alert(1)</script><a href="https://example.com" onclick="bad()">Guide</a><img src="https://example.com/photo.webp" onerror="bad()">',
    );
    expect(clean).toContain("https://example.com");
    expect(clean).toContain("noopener noreferrer");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("onclick");
    expect(clean).not.toContain("onerror");
  });
});
