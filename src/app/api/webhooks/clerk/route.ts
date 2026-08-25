import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { eq, or } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { auditEvents, members } from "@/db/schema";
import { notifyDiscordAdmin } from "@/lib/discord";
import { isUtsaStudentEmail, normalizeEmail } from "@/lib/membership-policy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasDatabase()) return new Response("Database unavailable", { status: 503 });
  try {
    const event = await verifyWebhook(request);
    if (event.type === "user.created" || event.type === "user.updated") {
      const data = event.data;
      const primary = data.email_addresses?.find((item) => item.id === data.primary_email_address_id) ?? data.email_addresses?.[0];
      if (!primary?.email_address) return new Response("Email required", { status: 400 });
      const email = normalizeEmail(primary.email_address);
      const verifiedUniversityEmail = data.email_addresses?.find(
        (item) =>
          item.verification?.status === "verified" &&
          isUtsaStudentEmail(item.email_address),
      )?.email_address;
      const normalizedUniversityEmail = verifiedUniversityEmail
        ? normalizeEmail(verifiedUniversityEmail)
        : null;
      const isOwner = email === (process.env.INITIAL_SUPER_ADMIN_EMAIL || "admin@210robotics.com").toLowerCase();
      const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ") || email.split("@")[0];
      const [emailMatch] = await getDb()
        .select({ id: members.id, clerkUserId: members.clerkUserId })
        .from(members)
        .where(
          normalizedUniversityEmail
            ? or(
                eq(members.email, email),
                eq(
                  members.normalizedUniversityEmail,
                  normalizedUniversityEmail,
                ),
              )
            : eq(members.email, email),
        )
        .limit(1);
      if (emailMatch) {
        if (emailMatch.clerkUserId !== data.id) {
          await getDb().insert(auditEvents).values({
            action: "identity.duplicate_blocked",
            entityType: "member",
            entityId: emailMatch.id,
            details: {
              source: "clerk_webhook",
              reason: "A verified university email is already linked.",
            },
          });
          await notifyDiscordAdmin({
            title: "Duplicate member identity blocked",
            body: "A Clerk account attempted to use an already-linked verified UTSA email. Review the member migration queue.",
            path: "/admin?tab=members&filter=duplicates",
          }).catch(() => undefined);
          return new Response("Duplicate identity recorded for review", {
            status: 200,
          });
        }
        await getDb()
          .update(members)
          .set({
            email,
            normalizedUniversityEmail,
            universityEmailVerifiedAt: normalizedUniversityEmail
              ? new Date()
              : null,
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            updatedAt: new Date(),
          })
          .where(eq(members.id, emailMatch.id));
      } else {
        await getDb().insert(members).values({
          clerkUserId: data.id,
          email,
          normalizedUniversityEmail,
          universityEmailVerifiedAt: normalizedUniversityEmail
            ? new Date()
            : null,
          firstName: data.first_name || "",
          lastName: data.last_name || "",
          displayName,
          photoUrl: data.image_url || null,
          status: isOwner ? "ACTIVE" : "PENDING",
          accessRole: isOwner ? "SUPER_ADMIN" : "MEMBER",
          organizationRole: isOwner ? "President" : "Member",
          accessState: isOwner
            ? "ACTIVE_MEMBER"
            : normalizedUniversityEmail
              ? "PROFILE_INCOMPLETE"
              : "UTSA_EMAIL_PENDING",
          isPublic: false,
        }).onConflictDoUpdate({
          target: members.clerkUserId,
          set: {
            email,
            normalizedUniversityEmail,
            universityEmailVerifiedAt: normalizedUniversityEmail
              ? new Date()
              : null,
            updatedAt: new Date(),
          },
        });
        if (!isOwner) {
          await notifyDiscordAdmin({
            title: "Pending member account",
            body: `${displayName} (${email}) created a portal account and is waiting for approval.`,
            path: "/admin?tab=members",
          }).catch((error: unknown) =>
            console.error("Discord pending-account notification failed", error),
          );
        }
      }
    }
    if (event.type === "user.deleted" && event.data.id) {
      await getDb().update(members).set({ status: "SUSPENDED", isPublic: false, updatedAt: new Date() }).where(eq(members.clerkUserId, event.data.id));
    }
    return new Response("ok");
  } catch (error) {
    console.error("Clerk webhook verification failed", error);
    return new Response("Invalid webhook", { status: 400 });
  }
}
