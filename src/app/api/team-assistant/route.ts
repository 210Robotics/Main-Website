import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  docPages,
  engineeringNotebookEntries,
  engineeringParts,
  glossaryTerms,
  operationsHubRecords,
} from "@/db/schema";
import { requireMemberEntitlement } from "@/lib/auth";
import { canAccessAdmin, hasPermission } from "@/lib/permissions";
import { generateGeminiText } from "@/lib/team-ai";

export const runtime = "nodejs";

type Source = { id: string; title: string; excerpt: string; href: string };

function plain(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 700);
}

export async function POST(request: Request) {
  const actor = await requireMemberEntitlement();
  const parsed = z
    .object({ query: z.string().trim().min(2).max(500) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json(
      { message: "Enter a question with at least two characters." },
      { status: 400 },
    );
  const query = parsed.data.query;
  const searchTerm =
    query
      .match(/[a-zA-Z0-9_-]{3,}/g)
      ?.filter((term) => !["what", "when", "where", "which", "with", "from", "that", "this", "team", "does", "have", "about"].includes(term.toLowerCase()))
      .sort((a, b) => b.length - a.length)[0] || query;
  const pattern = `%${searchTerm.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const fullNotebook =
    hasPermission(
      actor.accessRole,
      "notebook.view",
      actor.permissionOverrides,
    ) ||
    hasPermission(
      actor.accessRole,
      "notebook.manage",
      actor.permissionOverrides,
    );
  const admin = canAccessAdmin(actor.accessRole, actor.permissionOverrides);
  const visibleDocs = admin
    ? undefined
    : inArray(docPages.visibility, ["PUBLIC", "MEMBERS_ONLY"]);
  const db = getDb();
  const [pages, terms, notebook, parts, hub] = await Promise.all([
    db
      .select({ id: docPages.id, title: docPages.title, body: docPages.bodyHtml, path: docPages.path })
      .from(docPages)
      .where(
        and(
          isNull(docPages.archivedAt),
          eq(docPages.status, "PUBLISHED"),
          visibleDocs,
          or(ilike(docPages.title, pattern), ilike(docPages.bodyHtml, pattern)),
        ),
      )
      .limit(8),
    db
      .select()
      .from(glossaryTerms)
      .where(
        and(
          eq(glossaryTerms.published, true),
          or(
            ilike(glossaryTerms.term, pattern),
            ilike(glossaryTerms.definition, pattern),
          ),
        ),
      )
      .limit(8),
    db
      .select()
      .from(engineeringNotebookEntries)
      .where(
        and(
          fullNotebook
            ? undefined
            : inArray(engineeringNotebookEntries.status, [
                "APPROVED",
                "PUBLISHED",
              ]),
          or(
            ilike(engineeringNotebookEntries.title, pattern),
            ilike(engineeringNotebookEntries.contentHtml, pattern),
            ilike(engineeringNotebookEntries.objective, pattern),
            ilike(engineeringNotebookEntries.results, pattern),
          ),
        ),
      )
      .orderBy(desc(engineeringNotebookEntries.updatedAt))
      .limit(8),
    db
      .select()
      .from(engineeringParts)
      .where(
        or(
          ilike(engineeringParts.name, pattern),
          ilike(engineeringParts.partNumber, pattern),
          ilike(engineeringParts.description, pattern),
          ilike(engineeringParts.subsystem, pattern),
        ),
      )
      .limit(8),
    admin
      ? db
          .select()
          .from(operationsHubRecords)
          .where(
            and(
              isNull(operationsHubRecords.archivedAt),
              or(
                ilike(operationsHubRecords.title, pattern),
                ilike(operationsHubRecords.description, pattern),
              ),
            ),
          )
          .orderBy(desc(operationsHubRecords.updatedAt))
          .limit(8)
      : Promise.resolve([]),
  ]);
  const sources: Source[] = [
    ...pages.map((item) => ({
      id: `doc-${item.id}`,
      title: item.title,
      excerpt: plain(item.body),
      href: `/docs/${item.path}`,
    })),
    ...terms.map((item) => ({
      id: `term-${item.id}`,
      title: item.term,
      excerpt: item.definition,
      href: "/portal?tab=glossary",
    })),
    ...notebook.map((item) => ({
      id: `notebook-${item.id}`,
      title: item.title,
      excerpt: plain(
        `${item.objective} ${item.results} ${item.contentHtml}`,
      ),
      href: "/portal?tab=engineering",
    })),
    ...parts.map((item) => ({
      id: `part-${item.id}`,
      title: `${item.partNumber} · ${item.name}`,
      excerpt: `${item.description} ${item.subsystem} CAD ${item.cadStatus}; CAM ${item.camStatus}; verification ${item.verificationStatus}.`,
      href: "/portal?tab=engineering",
    })),
    ...hub.map((item) => ({
      id: `hub-${item.id}`,
      title: item.title,
      excerpt: `${item.kind}: ${item.description}`,
      href: "/admin/control-center?tab=team-os",
    })),
  ].slice(0, 20);
  if (!sources.length)
    return Response.json({
      answer:
        "I could not find a matching team source. Try a part number, subsystem, document title, glossary term, or shorter keyword.",
      sources: [],
    });

  let answer = `I found ${sources.length} relevant team source${sources.length === 1 ? "" : "s"}. Start with ${sources
    .slice(0, 3)
    .map((source, index) => `[${index + 1}] ${source.title}`)
    .join(", ")}.`;
  let generatedAnswer: string | null = null;
  const context = sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.title}\n${source.excerpt}`,
    )
    .join("\n\n");
  generatedAnswer = await generateGeminiText({
    userId: actor.id,
    feature: "team-search",
    system:
      "Answer only from the supplied team sources. Cite factual statements with source numbers like [1]. If evidence is incomplete, say what is missing. Be concise and practical.",
    prompt: `Question: ${query}\n\nTeam sources:\n${context}`,
    maxOutputTokens: 800,
  });
  if (generatedAnswer) answer = generatedAnswer;
  return Response.json(
    { answer, sources },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
