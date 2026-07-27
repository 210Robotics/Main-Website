import { describe, expect, it } from "vitest";
import {
  documentationHtmlToMarkdown,
  markdownToDocumentationHtml,
} from "@/lib/doc-format";

describe("documentation format conversion", () => {
  it("turns Markdown headings, lists, links, and code into HTML", () => {
    const html = markdownToDocumentationHtml(
      "## Drivebase\n\n- Test gearing\n- Record current\n\n[Open Doxygen](/doxygen/index.html)\n\n```cpp\nmove();\n```",
    );

    expect(html).toContain("<h2>Drivebase</h2>");
    expect(html).toContain("<li>Test gearing</li>");
    expect(html).toContain('href="/doxygen/index.html"');
    expect(html).toContain('<code class="language-cpp">move();');
  });

  it("turns stored HTML into editable Markdown", () => {
    const markdown = documentationHtmlToMarkdown(
      "<h2>Controls</h2><p>Document <strong>every</strong> input.</p>",
    );

    expect(markdown).toContain("## Controls");
    expect(markdown).toContain("**every**");
  });
});
