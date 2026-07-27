import { asc } from "drizzle-orm";
import { getDb } from "@/db";
import { engineeringParts, manufacturingSteps, members } from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { buildEngineeringWorkbook } from "@/lib/exports/workbooks";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  const member = await getCurrentMember();
  if (!member)
    return Response.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  if (
    !hasPermission(
      member.accessRole,
      "engineering.manage",
      member.permissionOverrides,
    )
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const [parts, steps, people] = await Promise.all([
    getDb()
      .select()
      .from(engineeringParts)
      .orderBy(asc(engineeringParts.project), asc(engineeringParts.partNumber)),
    getDb()
      .select()
      .from(manufacturingSteps)
      .orderBy(asc(manufacturingSteps.sequence)),
    getDb().select({ id: members.id, name: members.displayName }).from(members),
  ]);
  const workbook = await buildEngineeringWorkbook({
    parts,
    steps,
    memberNames: new Map(people.map((person) => [person.id, person.name])),
  });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="210-Robotics-Engineering-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
