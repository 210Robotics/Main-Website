import { getDb } from "@/db";
import { auditEvents, engineeringNotebookCompilations } from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { loadNotebookExportData } from "@/lib/exports/notebook-data";
import { buildEngineeringNotebookPdf } from "@/lib/exports/notebook-pdf";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getCurrentMember();
  if (!actor)
    return Response.json({ error: "Authentication required." }, { status: 401 });
  if (
    !hasPermission(actor.accessRole, "notebook.view", actor.permissionOverrides)
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });

  const params = new URL(request.url).searchParams;
  let exportData: Awaited<ReturnType<typeof loadNotebookExportData>>;
  try {
    exportData = await loadNotebookExportData(params);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Notebook export failed.",
      },
      { status: 400 },
    );
  }
  const { data, safeScope } = exportData;
  const buffer = await buildEngineeringNotebookPdf(data);
  const filename = `210-Robotics-Engineering-Notebook-${safeScope}-${new Date().toISOString().slice(0, 10)}.pdf`;
  const [compilation] = await getDb()
    .insert(engineeringNotebookCompilations)
    .values({
      seasonId: data.season.id,
      projectId: data.project?.id || null,
      filters: {
        ...data.options,
        format: "PDF",
        seasonId: data.season.id,
        projectId: data.project?.id || null,
      },
      entryCount: data.entries.length,
      filename,
      compiledByMemberId: actor.id,
    })
    .returning();
  await getDb().insert(auditEvents).values({
    actorMemberId: actor.id,
    action: "notebook.pdf_compiled",
    entityType: "notebook_compilation",
    entityId: compilation.id,
    details: { filename, entryCount: data.entries.length },
  });

  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
