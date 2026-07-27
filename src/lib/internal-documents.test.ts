import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { describe, expect, it, vi } from "vitest";
import {
  docxToEditableHtml,
  parseGoogleDriveDocumentLink,
  sanitizeInternalDocumentHtml,
} from "@/lib/internal-documents";

vi.mock("server-only", () => ({}));

describe("internal document conversion", () => {
  it("converts DOCX headings and text into editable notebook HTML", async () => {
    const source = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: [new TextRun("Drivetrain test plan")],
            }),
            new Paragraph({
              children: [
                new TextRun("Verify traction, current draw, and repeatability."),
              ],
            }),
          ],
        },
      ],
    });
    const buffer = await Packer.toBuffer(source);
    const converted = await docxToEditableHtml(
      "00000000-0000-4000-8000-000000000000",
      buffer,
    );

    expect(converted.html).toContain("<h1>Drivetrain test plan</h1>");
    expect(converted.html).toContain("Verify traction, current draw, and repeatability.");
    expect(converted.embeddedAssets).toEqual([]);
  });

  it("keeps safe notebook formatting while removing executable markup", () => {
    const html = sanitizeInternalDocumentHtml(
      '<h2 style="text-align:center" onclick="alert(1)">Test</h2><mark>Pass</mark><script>alert(1)</script>',
    );

    expect(html).toContain('style="text-align:center"');
    expect(html).toContain("<mark>Pass</mark>");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("script");
  });

  it("accepts Google Docs and Drive file links without allowing arbitrary downloads", () => {
    expect(
      parseGoogleDriveDocumentLink(
        "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit",
      ),
    ).toMatchObject({
      id: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
      nativeGoogleDoc: true,
    });
    expect(
      parseGoogleDriveDocumentLink(
        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view",
      ),
    ).toMatchObject({
      id: "1AbCdEfGhIjKlMnOpQrStUvWxYz",
      nativeGoogleDoc: false,
    });
    expect(() =>
      parseGoogleDriveDocumentLink(
        "https://example.com/1AbCdEfGhIjKlMnOpQrStUvWxYz",
      ),
    ).toThrow("Only Google Drive and Google Docs links can be imported.");
  });
});
