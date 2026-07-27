import { z } from "zod";
import { requirePermission } from "@/lib/auth";
import { generateGeminiText } from "@/lib/team-ai";

export const runtime = "nodejs";

const inputSchema = z.object({
  headers: z.array(z.string().max(120)).max(80),
  sample: z.array(z.record(z.string(), z.unknown())).max(8),
});

export async function POST(request: Request) {
  const actor = await requirePermission("engineering.manage");
  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Add or upload a BOM before asking for help." }, { status: 400 });
  const standard = ["part number", "name", "description", "quantity", "revision", "material", "supplier", "make / buy", "unit cost"];
  const normalized = parsed.data.headers.map((header) => header.toLowerCase());
  const missing = standard.filter((field) => !normalized.some((header) => header.includes(field.replace(" / ", "")) || header.includes(field)));
  const fallback = [
    `Detected ${parsed.data.headers.length} columns.`,
    missing.length ? `Consider adding or mapping: ${missing.join(", ")}.` : "The main part-master fields are present.",
    "Before import, verify that every row has a stable part number, quantity is numeric, revisions match the released Onshape version, and purchased items identify a supplier.",
  ].join(" ");
  const generated = await generateGeminiText({
    userId: actor.id,
    feature: "onshape-bom-import",
    system: "You are the 210 Robotics engineering data assistant. Review an Onshape BOM export and give concise, concrete cleanup and import advice. Never invent part data. Mention duplicate-risk, missing mappings, revision quality, quantities, and make/buy classification when relevant.",
    prompt: `Headers: ${parsed.data.headers.join(" | ")}\nSample rows:\n${JSON.stringify(parsed.data.sample, null, 2)}`,
    maxOutputTokens: 500,
  });
  return Response.json({ guidance: generated || fallback }, { headers: { "Cache-Control": "private, no-store" } });
}
