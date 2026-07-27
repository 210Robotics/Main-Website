import "server-only";

import sanitizeHtml from "sanitize-html";

export function sanitizeDocumentationHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img", "figure", "figcaption", "h1", "h2", "h3", "h4", "s",
      "table", "thead", "tbody", "tr", "th", "td", "input",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      input: ["type", "checked", "disabled"],
      "*": ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
      input: sanitizeHtml.simpleTransform("input", { disabled: "disabled" }),
    },
  });
}

export function docSearchText(html: string) {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

export function docHeadings(html: string) {
  const matches = [...html.matchAll(/<h([2-3])[^>]*>(.*?)<\/h\1>/gi)];
  return matches.map((match, index) => ({
    level: Number(match[1]),
    title: docSearchText(match[2]),
    id: `section-${index + 1}`,
  }));
}

