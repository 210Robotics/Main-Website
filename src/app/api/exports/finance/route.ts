import { asc, desc } from "drizzle-orm";
import { getDb } from "@/db";
import {
  financeEntries,
  financePlans,
  financeSponsorCommitments,
} from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { buildFinanceWorkbook } from "@/lib/exports/workbooks";
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
      "finance.manage",
      member.permissionOverrides,
    )
  )
    return Response.json({ error: "Forbidden" }, { status: 403 });
  const [plans, entries, sponsors] = await Promise.all([
    getDb()
      .select()
      .from(financePlans)
      .orderBy(desc(financePlans.fiscalYear), asc(financePlans.name)),
    getDb()
      .select()
      .from(financeEntries)
      .orderBy(desc(financeEntries.occurredAt)),
    getDb()
      .select()
      .from(financeSponsorCommitments)
      .orderBy(asc(financeSponsorCommitments.sponsorName)),
  ]);
  const workbook = await buildFinanceWorkbook({ plans, entries, sponsors });
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="210-Robotics-Finance-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
