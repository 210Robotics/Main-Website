import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { membershipDuesPayments, members } from "@/db/schema";
import { getCurrentMember } from "@/lib/auth";
import { buildMembershipReceiptPdf } from "@/lib/exports/membership-receipt-pdf";
import { hasPermission } from "@/lib/permissions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const current = await getCurrentMember();
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const [row] = await getDb()
    .select({ payment: membershipDuesPayments, memberName: members.displayName })
    .from(membershipDuesPayments)
    .innerJoin(members, eq(members.id, membershipDuesPayments.memberId))
    .where(and(eq(membershipDuesPayments.id, id), eq(membershipDuesPayments.status, "PAID")))
    .limit(1);
  if (!row) return NextResponse.json({ error: "Receipt not found" }, { status: 404 });
  const canManage = hasPermission(current.accessRole, "dues.manage", current.permissionOverrides);
  if (row.payment.memberId !== current.id && !canManage) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const pdf = await buildMembershipReceiptPdf({
    receiptNumber: row.payment.receiptNumber || `210-${row.payment.id.slice(0, 8).toUpperCase()}`,
    memberName: row.memberName,
    paymentDate: row.payment.paymentDate || row.payment.paidAt || row.payment.createdAt,
    amountCents: Math.max(0, row.payment.amountCents - row.payment.refundedCents),
    paymentMethod: row.payment.paymentMethod,
    coveragePeriod: row.payment.coveragePeriod,
    transactionReference: row.payment.transactionReference,
    status: row.payment.status,
  });
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="210-robotics-receipt-${row.payment.receiptNumber || row.payment.id}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
