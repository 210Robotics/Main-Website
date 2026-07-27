import { marked } from "marked";
import TurndownService from "turndown";

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  headingStyle: "atx",
});

export function markdownToDocumentationHtml(markdown: string) {
  return marked.parse(markdown, {
    async: false,
    gfm: true,
  });
}

export function documentationHtmlToMarkdown(html: string) {
  return turndown.turndown(html);
}
