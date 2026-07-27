import { createHash } from "node:crypto";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { getDb, hasDatabase } from "@/db";
import { emailDeliveries, inquiries } from "@/db/schema";
import { notifyDiscordAdmin } from "@/lib/discord";
import { adminInquiryEmail, confirmationEmail, getResend } from "@/lib/email";

export const runtime = "nodejs";

const schema = z.object({
  kind: z.enum(["contact", "join", "sponsor"]),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(200),
  organization: z.string().trim().max(160).optional().default(""),
  interest: z.string().trim().max(100).optional().default(""),
  message: z.string().trim().min(10).max(4000),
  sourcePath: z.string().max(200).optional().default("/"),
  website: z.string().max(0).optional().default(""),
});

export async function POST(request: Request) {
  if (!hasDatabase()) return Response.json({ ok: false, message: "The inquiry service is being configured. Please email admin@210robotics.com." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, message: "Please review the highlighted fields and try again." }, { status: 400 });

  const input = parsed.data;
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const fingerprint = createHash("sha256").update(`${process.env.INQUIRY_HASH_SALT || "210-robotics"}:${forwarded}:${input.email.toLowerCase()}`).digest("hex");
  const since = new Date(Date.now() - 10 * 60 * 1000);
  const db = getDb();
  const [rate] = await db.select({ value: count() }).from(inquiries).where(and(eq(inquiries.requestFingerprint, fingerprint), gte(inquiries.createdAt, since)));
  if ((rate?.value ?? 0) >= 3) return Response.json({ ok: false, message: "Too many messages were submitted recently. Please try again later." }, { status: 429 });

  const [created] = await db.insert(inquiries).values({
    kind: input.kind,
    name: input.name,
    email: input.email.toLowerCase(),
    organization: input.organization || null,
    interest: input.interest || null,
    message: input.message,
    sourcePath: input.sourcePath,
    requestFingerprint: fingerprint,
    status: input.website ? "SPAM" : "NEW",
  }).returning({ id: inquiries.id });

  if (input.website) return Response.json({ ok: true, id: created.id });
  await notifyDiscordAdmin({
    title: `New ${input.kind} inbox message`,
    body: `${input.name} (${input.email}) submitted a new ${input.kind} inquiry.`,
    path: "/admin?tab=inbox",
  }).catch((error: unknown) =>
    console.error("Discord inquiry notification failed", error),
  );
  const resend = getResend();
  const notificationEmail = "admin@210robotics.com";
  const recipients = [...new Set([notificationEmail, input.email.toLowerCase()])];
  await db.insert(emailDeliveries).values(recipients.map((recipient) => ({ inquiryId: created.id, recipient })));
  if (!resend) return Response.json({ ok: true, id: created.id, emailPending: true });

  const from = process.env.INQUIRY_FROM_EMAIL || "210 Robotics Website <website@updates.210robotics.com>";
  const sends = [
    { recipient: notificationEmail, subject: `New ${input.kind} inquiry from ${input.name}`, html: adminInquiryEmail(input), replyTo: input.email },
    ...(input.email.toLowerCase() === notificationEmail ? [] : [{ recipient: input.email.toLowerCase(), subject: "210 Robotics received your message", html: confirmationEmail(input.name, input.kind), replyTo: notificationEmail }]),
  ];
  for (const delivery of sends) {
    const { data, error } = await resend.emails.send({ from, to: delivery.recipient, subject: delivery.subject, html: delivery.html, replyTo: delivery.replyTo }, { idempotencyKey: `inquiry-${created.id}-${delivery.recipient}` });
    await db.update(emailDeliveries).set({ status: error ? "FAILED" : "SENT", attempts: 1, providerId: data?.id, lastError: error?.message, updatedAt: new Date() }).where(and(eq(emailDeliveries.inquiryId, created.id), eq(emailDeliveries.recipient, delivery.recipient)));
  }
  return Response.json({ ok: true, id: created.id });
}
