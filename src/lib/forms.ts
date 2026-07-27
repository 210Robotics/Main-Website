import "server-only";

import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import { formFieldTypes, optionFieldTypes } from "@/lib/form-types";

export const publicFormFieldSchema = z.object({
  id: z.uuid(),
  type: z.enum(formFieldTypes),
  label: z.string().trim().min(1).max(240),
  description: z.string().trim().max(600),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(180)).max(100),
  maxFiles: z.number().int().min(1).max(5).optional(),
});

export const publicFormFieldsSchema = z
  .array(publicFormFieldSchema)
  .max(80)
  .superRefine((fields, context) => {
    const ids = new Set<string>();
    for (const [index, field] of fields.entries()) {
      if (ids.has(field.id)) {
        context.addIssue({
          code: "custom",
          message: "Every question must have a unique identifier.",
          path: [index, "id"],
        });
      }
      ids.add(field.id);
      if (optionFieldTypes.includes(field.type) && field.options.length < 2) {
        context.addIssue({
          code: "custom",
          message: "Choice questions need at least two options.",
          path: [index, "options"],
        });
      }
      if (field.type === "FILE_UPLOAD" && !field.maxFiles) {
        context.addIssue({
          code: "custom",
          message: "Choose how many files this question accepts.",
          path: [index, "maxFiles"],
        });
      }
    }
  });

export function sanitizeFormHtml(value: string) {
  return sanitizeHtml(value, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat([
      "img",
      "figure",
      "figcaption",
      "h1",
      "h2",
      "h3",
      "s",
    ]),
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
  });
}
