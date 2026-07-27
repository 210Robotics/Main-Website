import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { memberTasks } from "@/db/schema";
import { requireActiveMember } from "@/lib/auth";
import { safeUploadFilename } from "@/lib/form-files";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const member = await requireActiveMember();
    const body = (await request.json()) as {
      taskId?: string;
      filename?: string;
    };
    if (!body.taskId || !body.filename)
      return Response.json(
        { error: "Task and filename are required." },
        { status: 400 },
      );
    const [task] = await getDb()
      .select({ assignee: memberTasks.assignedToMemberId })
      .from(memberTasks)
      .where(
        and(eq(memberTasks.id, body.taskId), isNull(memberTasks.archivedAt)),
      )
      .limit(1);
    const manages = hasPermission(
      member.accessRole,
      "tasks.manage",
      member.permissionOverrides,
    );
    if (!task || (task.assignee !== member.id && !manages))
      return Response.json({ error: "Forbidden" }, { status: 403 });
    return Response.json({
      pathname: `uploads/task-attachment/${body.taskId}/${member.id}/${crypto.randomUUID()}-${safeUploadFilename(body.filename)}`,
    });
  } catch {
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }
}
