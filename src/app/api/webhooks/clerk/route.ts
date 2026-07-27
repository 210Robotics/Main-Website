import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, hasDatabase } from "@/db";
import { members } from "@/db/schema";
import { notifyDiscordAdmin } from "@/lib/discord";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  if (!hasDatabase()) return new Response("Database unavailable", { status: 503 });
  try {
    const event = await verifyWebhook(request);
    if (event.type === "user.created" || event.type === "user.updated") {
      const data = event.data;
      const primary = data.email_addresses?.find((item) => item.id === data.primary_email_address_id) ?? data.email_addresses?.[0];
      if (!primary?.email_address) return new Response("Email required", { status: 400 });
      const email = primary.email_address.toLowerCase();
      const isOwner = email === (process.env.INITIAL_SUPER_ADMIN_EMAIL || "admin@210robotics.com").toLowerCase();
      const displayName = [data.first_name, data.last_name].filter(Boolean).join(" ") || email.split("@")[0];
      const [emailMatch] = await getDb()
        .select({ id: members.id })
        .from(members)
        .where(eq(members.email, email))
        .limit(1);
      if (emailMatch) {
        await getDb()
          .update(members)
          .set({
            clerkUserId: data.id,
            email,
            updatedAt: new Date(),
          })
          .where(eq(members.id, emailMatch.id));
      } else {
        await getDb().insert(members).values({
          clerkUserId: data.id,
          email,
          displayName,
          photoUrl: data.image_url || null,
          status: isOwner ? "ACTIVE" : "PENDING",
          accessRole: isOwner ? "SUPER_ADMIN" : "MEMBER",
          organizationRole: isOwner ? "President" : "Member",
          isPublic: isOwner,
        }).onConflictDoUpdate({ target: members.clerkUserId, set: { email, updatedAt: new Date() } });
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
